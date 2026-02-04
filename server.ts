#!/usr/bin/env node

import { config } from 'dotenv';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    McpError,
    ErrorCode
} from "@modelcontextprotocol/sdk/types.js";
import { ADTClient, session_types } from "abap-adt-api";
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { ObjectHandler } from './tool_handlers/ObjectHandler.js';
import { ClassHandler } from './tool_handlers/ClassHandler.js';
import { ReferenceHandler } from './tool_handlers/ReferenceHandler.js';
import { GeneralInfoHandler } from './tool_handlers/GeneralInfoHandler.js';
import { DdicHandler } from './tool_handlers/DdicHandler.js';
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { executeHttpRequest } from '@sap-cloud-sdk/http-client';
import { requestContext } from './utils/requestContext.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: path.resolve(__dirname, '../.env') });


export class AbapAdtServer extends Server {
    
    private adtClient?: ADTClient;
    private objectHandler: ObjectHandler;
    private classHandler: ClassHandler;
    private referenceHandler: ReferenceHandler;
    private generalInfoHandler: GeneralInfoHandler;
    private ddicHandler: DdicHandler;

    constructor() {
        super(
            {
                name: "mcp-abap-scc",
                version: "0.1.0",
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        const connectionMode = process.env.CONNECTION_MODE || 'DIRECT';

        if (connectionMode === 'DIRECT') {
            
            const missingVars = ['SAP_URL', 'SAP_USER', 'SAP_PASSWORD'].filter(v => !process.env[v]);
            if (missingVars.length > 0) {
                throw new Error(`Missing required environment variables for LOCAL mode: ${missingVars.join(', ')}`);
            }

            this.adtClient = new ADTClient(
                process.env.SAP_URL as string,
                process.env.SAP_USER as string,
                process.env.SAP_PASSWORD as string,
                process.env.SAP_CLIENT as string,
                process.env.SAP_LANGUAGE as string
            );
            
            // Если abap-adt-api поддерживает stateful, оставляем
            if (session_types) {
                 this.adtClient.stateful = session_types.stateful;
            }
        } 
        else {
          
            console.log('Running in CLOUD mode (BTP). ADTClient instantiation skipped.');
            
        }

        this.objectHandler = new ObjectHandler();
        this.classHandler = new ClassHandler();
        this.referenceHandler = new ReferenceHandler();
        this.generalInfoHandler = new GeneralInfoHandler();
        this.ddicHandler = new DdicHandler();
        this.setupToolHandlers();
    }
    private serializeResult(result: any) {
        try {
            // 1. Если хендлер вернул пустоту
            if (!result) {
                return { content: [{ type: 'text', text: 'No data returned' }] };
            }
    
        
            if (result && typeof result === 'object' && result.content) {
                return result;
            }
    
          
            return {
                content: [{
                    type: 'text',
                    text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                }]
            };
        } catch (error) {
            return {
                content: [{ type: 'text', text: `Serialization Error: ${String(error)}` }],
                isError: true
            };
        }
    }

    /*
    private serializeResult(result: any) {
        try {
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(result, (key, value) =>
                        typeof value === 'bigint' ? value.toString() : value
                    )
                }]
            };
        } catch (error) {
            return this.handleError(new McpError(
                ErrorCode.InternalError,
                'Failed to serialize result'
            ));
        }
    }
    */

    private handleError(error: unknown) {
        if (!(error instanceof Error)) {
            error = new Error(String(error));
        }
        if (error instanceof McpError) {
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        error: error.message,
                        code: error.code
                    })
                }],
                isError: true
            };
        }
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    error: 'Internal server error',
                    code: ErrorCode.InternalError
                })
            }],
            isError: true
        };
    }

    private setupToolHandlers() {
        this.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    ...this.objectHandler.getTools(),
                    ...this.classHandler.getTools(),
                    ...this.referenceHandler.getTools(),
                    ...this.ddicHandler.getTools(),
                    ...this.generalInfoHandler.getTools(),
                    {
                        name: 'healthcheck',
                        description: 'Check server health and connectivity',
                        inputSchema: {
                            type: 'object',
                            properties: {}
                        }
                    }
                ]
            };
        });

        this.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                
                let result: any;

              


          

                switch (request.params.name) {
                    case 'getObjects':
                    case 'getObjectStructure':
                    case 'getObjectSourceCode':
                    case 'getObjectFullPath':
                    case 'getObjectVersionHistory':
                    case 'getPackageObjects':
                    case 'getFunction':    
                    case 'getFunctionGroup':  
                    case 'getInclude':    
                    case 'getInterface':  
                    case 'getProgram':
                    case 'getTransaction':    
                        result = await this.objectHandler.handle(request.params.name, request.params.arguments);
                        break;
                    case 'getClassComponents':
                    case 'getServiceBindingDetails':
                        result = await this.classHandler.handle(request.params.name, request.params.arguments);
                        break;
                    case 'getUsageReferences':
                    case 'getUsageReferenceSnippets':
                        result = await this.referenceHandler.handle(request.params.name, request.params.arguments);
                        break;
                    case 'getAllAnnotations':
                    case 'getAllObjectTypes':
                        result = await this.generalInfoHandler.handle(request.params.name, request.params.arguments);
                        break;
                    case 'getDdicElementDetails':
                    case 'getTable':    
                    case  'getTypeInfo':
                    case 'getPackagesByName':
                    case 'getTableContent':
                    case 'runSqlQuery':
                        result = await this.ddicHandler.handle(request.params.name, request.params.arguments);
                        break;
                    case 'healthcheck':
                        result = { status: 'healthy', timestamp: new Date().toISOString() };
                        break;
                    default:
                        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
                }

                return this.serializeResult(result);
            } catch (error) {
                return this.handleError(error);
            }
        });
    }
}

const server = new AbapAdtServer();
const app = express();
app.use(express.json());

app.post('/mcp', async (req: express.Request, res: express.Response) => {

    const authHeader = req.headers.authorization;
    const jwt = authHeader?.split(' ')[1];


    const allowedHostsString = process.env.MCP_ALLOWED_HOSTS;
    const allowedOriginsString = process.env.MCP_ALLOWED_ORIGINS;

    const parsedAllowedHosts = allowedHostsString ? allowedHostsString.split(',') : ['127.0.0.1'];
    const parsedAllowedOrigins = allowedOriginsString ? allowedOriginsString.split(',') : [];

    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
        allowedHosts: parsedAllowedHosts, 
        allowedOrigins: parsedAllowedOrigins, 
    });

    res.on('close', () => {
        transport.close();
    });


    requestContext.run({ jwt }, async () => {
        try {
            await server.connect(transport);
            // Передаем исходный body без всяких модификаций!
            await transport.handleRequest(req, res, req.body);
        } catch (err) {
            console.error('MCP Request Error:', err);
            
        }
    });


  //  await server.connect(transport);
  //  await transport.handleRequest(req, res, req.body);


});    

app.get('/mcp/', async (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).send('Токен не найден! Проверьте привязку XSUAA.');
    }

    const token = authHeader.split(' ')[1];
    
    // Декодируем токен (просто чтобы посмотреть содержимое без верификации)
    const base64Payload = token.split('.')[1];
    const payload = Buffer.from(base64Payload, 'base64').toString();
    const parsedPayload = JSON.parse(payload);

    console.log("--- Входящий JWT токен ---");
    console.log(payload);
/*
    res.send(`
        <h1>Связь установлена!</h1>
        <p><b>Твой токен:</b></p>
        <textarea style="width:100%; height:200px;">${token}</textarea>
        <p><b>Данные из токена (Payload):</b></p>
        <pre>${JSON.stringify(JSON.parse(payload), null, 2)}</pre>
    `);
    */

   let sapResponse = '';
    let statusColor = 'green';
    let statusText = 'УСПЕХ: SAP S/4HANA ответила!';

    // 2. Делаем РЕАЛЬНЫЙ запрос в SAP используя токен пользователя
    try {
        console.log("--> Отправляем запрос в SAP через Cloud Connector...");
        
        const response = await executeHttpRequest(
            { 
                
                destinationName: process.env.DESTINATION_NAME || 'A4H_ADT_PR', 
                jwt: token
            },
            {
                method: 'GET',
                url: `/sap/bc/adt/repository/informationsystem/search`,
                params: {
                    'operation': 'quickSearch',
                    'query': "CL_ABAP_MATH*",
                    'maxResults': 2
                },
                headers: {
                    'Accept': 'application/xml'
                }
            }
        );

        sapResponse = response.data; // XML ответ от SAP
        
    } catch (error: any) {
        statusColor = 'red';
        statusText = 'ОШИБКА: SAP отклонил запрос (см. детали ниже)';
        console.error("SAP Request Failed", error.message);
        
        // Пытаемся достать текст ошибки от SAP
        sapResponse = error.response?.data || error.message || JSON.stringify(error);
    }

    
res.send(`
        <html>
        <body style="font-family: sans-serif; padding: 20px; line-height: 1.5;">
            <h1 style="color: ${statusColor}">${statusText}</h1>
            
            <section style="margin-bottom: 20px; border: 1px solid #ccc; padding: 15px; border-radius: 8px;">
                <h3>1. Твой JWT Токен для Postman:</h3>
                <p>Используй этот токен в заголовке <code>Authorization: Bearer &lt;token&gt;</code></p>
                <textarea id="tokenArea" readonly style="width:100%; height:80px; font-family: monospace; background: #f9f9f9; padding: 10px;">${token}</textarea>
                <br>
                <button onclick="copyToken()" style="margin-top: 10px; cursor: pointer; padding: 8px 16px;">Копировать токен</button>
            </section>

            <div style="background: #eef; padding: 10px; border-radius: 5px; margin-bottom: 20px;">
                <strong>User Email:</strong> ${parsedPayload.email || parsedPayload.user_name} <br>
                <strong>Scopes:</strong> ${parsedPayload.scope ? parsedPayload.scope.join(', ') : 'none'}
            </div>

            <h3>2. Ответ от SAP S/4HANA (Principal Propagation):</h3>
            <p>Если ниже виден XML — значит SAP узнал пользователя <b>${parsedPayload.email}</b> и пустил его.</p>
            <textarea style="width:100%; height:300px; font-family: monospace; border: 2px solid ${statusColor}; background: #222; color: #0f0; padding: 10px;">
${typeof sapResponse === 'object' ? JSON.stringify(sapResponse, null, 2) : sapResponse}
            </textarea>
            
            <br><br>
            <button onclick="location.reload()" style="padding: 10px 20px;">Обновить статус</button>

            <script>
                function copyToken() {
                    var copyText = document.getElementById("tokenArea");
                    copyText.select();
                    copyText.setSelectionRange(0, 99999);
                    navigator.clipboard.writeText(copyText.value);
                    alert("Токен скопирован в буфер обмена");
                }
            </script>
        </body>
        </html>
    `);



});

const port = parseInt(process.env.PORT || '3000');
app.listen(port, () => {
    console.log(`Demo MCP Server running on http://localhost:${port}/mcp`);
}).on('error', (error: Error) => {
    console.error('Server error:', error);
    process.exit(1);
});