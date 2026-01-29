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
    if (authHeader) {
        console.log("УРА! Авторизация получена.");
        // Выведет зашифрованный токен (начинается на eyJ...)
        console.log("JWT Token:", authHeader.substring(0, 50) + "..."); 
    } else {
        console.log("ВНИМАНИЕ: Запрос пришел без авторизации!");
    }

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

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
});

const port = parseInt(process.env.PORT || '3000');
app.listen(port, () => {
    console.log(`Demo MCP Server running on http://localhost:${port}/mcp`);
}).on('error', (error: Error) => {
    console.error('Server error:', error);
    process.exit(1);
});