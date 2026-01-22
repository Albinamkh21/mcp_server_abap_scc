//import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';
import { 
    McpError, 
    ErrorCode, 
    makeAdtRequest, 
    return_error, 
    return_response ,
    transformNamedItems
 
} from '../utils/utils.js'; 

export class ReferenceHandler  {
    getTools(): ToolDefinition[] {
        return [
            {
                name: 'getUsageReferences',
                description: 'Finds URLs of objects that contain references to given object',
                inputSchema: {
                    type: 'object',
                    properties: {
                        objectUrl: { type: 'string' }
                    },
                    required: ['objectUrl']
                }
            },
            {
                name: 'getUsageReferenceSnippets',
                description: 'Retrieves lines of code which the given reference(s) contain(s).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        usageReferences: { type: 'array' }
                    },
                    required: ['usageReferences']
                }
            }
        ];
    }

    async handle(toolName: string, args: any): Promise<any> {
        switch (toolName) {
            case 'getUsageReferences':
                return this.handleUsageReferences(args);
           // case 'getUsageReferenceSnippets':
             //   return this.handleUsageReferenceSnippets(args);
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown code analysis tool: ${toolName}`);
        }
    }
    

    async handleUsageReferences(args: any): Promise<any> {
        try {
            if (!args?.objectUrl) {
                throw new McpError(ErrorCode.InvalidParams, 'Object URL is required');
            }
    
            // В adt-api URI объекта используется как есть (например, /sap/bc/adt/oo/classes/zcl_class)
            const objectUri = args.objectUrl;
            
            const url = `/sap/bc/adt/repository/ris/usages`;
    
            // ВНУТРЕННЯЯ РЕАЛИЗАЦИЯ ADT-API:
            // 1. Используется пространство имен http://www.sap.com/adt/ris/usages
            // 2. Корневой элемент - usage:uriReference
            const body = `<?xml version="1.0" encoding="UTF-8"?>
    <usage:uriReference xmlns:usage="http://www.sap.com/adt/ris/usages">
    <usage:uri>${objectUri}</usage:uri>
    </usage:uriReference>`;
    
            const response = await makeAdtRequest(
                url,
                'POST',
                30000,
                body,
                { 
                    // Параметр передается в Query String
                    'ris_request_type': 'usage_list' 
                },
                { 
                    // Эти заголовки жестко прописаны в исходниках adt-api
                    'Content-Type': 'application/vnd.sap.adt.ris.usages.v1+xml',
                    'Accept': 'application/vnd.sap.adt.ris.whereusedlist.v1+xml'
                }
            );
    
            // Возвращаем чистый ответ, чтобы убедиться, что "No suitable resource" ушла
            return return_response(response);
    
        } catch (error) {
            return return_error(error);
        }
    }



/*
    async handleUsageReferenceSnippets(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            await this.adtclient.login();
            const result = await this.adtclient.usageReferenceSnippets(args.usageReferences);
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            result
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Usage reference snippets failed: ${error.message || 'Unknown error'}`
            );
        }
    }
        */
/*
    async handleMainPrograms(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const mainPrograms = await this.adtclient.mainPrograms(args.includeUrl);
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            mainPrograms
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get main programs: ${error.message || 'Unknown error'}`
            );
        }
    }
        */

}