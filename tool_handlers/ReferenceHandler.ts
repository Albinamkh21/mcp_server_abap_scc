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
            case 'getUsageReferenceSnippets':
                return this.handleUsageReferenceSnippets(args);
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown code analysis tool: ${toolName}`);
        }
    }
    

    async handleUsageReferences(args: any): Promise<any> {
        try {
            const objectUri = args.objectUrl;
            const url = "/sap/bc/adt/repository/informationsystem/usageReferences";
    
            const body = `<?xml version="1.0" encoding="UTF-8"?>
    <usageReferenceRequest xmlns="http://www.sap.com/adt/ris/usageReferences" maxResults="50">
        <objectIdentifiers>
            <objectIdentifier>${objectUri}</objectIdentifier>
        </objectIdentifiers>
    </usageReferenceRequest>`;
    
            const headers = { 
                'Content-Type': 'application/vnd.sap.adt.repository.usagereferences.request.v1+xml',
                // ИСПРАВЛЕНО: Теперь строго по требованию ошибки 044
                'Accept': 'application/vnd.sap.adt.repository.usagereferences.result.v1+xml'
            };
    
            const response = await makeAdtRequest(
                url,
                'POST',
                60000, 
                body,
                { 
                    'uri': objectUri,
                    'maxResults': '50'
                }, 
                headers
            );
    
            return return_response(response);
    
        } catch (error) {
            return return_error(error);
        }
    }

    async handleUsageReferenceSnippets(args: any): Promise<any> {
        try {
            const inputString = JSON.stringify(args);
            
            const uris = inputString.match(/\/sap\/bc\/adt\/[^"<\s]+(?:\/source\/main|\/includes\/[^"<\s]+)/g) || [];
            
            if (uris.length === 0) {
                return { content: [{ type: "text", text: "No source URIs found in the input." }] };
            }
    
            const uniqueUris = [...new Set(uris)].slice(0, 5); 
            const results = [];
    
            for (const uri of uniqueUris) {
                try {
                  
                    const response = await makeAdtRequest(
                        uri,
                        'GET',
                        15000,
                        null,
                        {},
                        { 'Accept': 'text/plain' }
                    );
                    
                    if (response && response.data) {
                        results.push(`--- Source: ${uri} ---\n${response.data.slice(0, 1000)}...\n`);
                    }
                } catch (e: any) {
                    results.push(`Error loading ${uri}: ${e.message}`);
                }
            }
    
            return {
                content: [{ type: "text", text: results.join('\n\n') }]
            };
        } catch (error: any) {
            return { content: [{ type: "text", text: `Error: ${error.message}` }] };
        }
    }


    
/*
    async handleUsageReferenceSnippets(args: any): Promise<any> {
        try {
            const inputString = JSON.stringify(args);
            
         
            const rawUris = inputString.match(/\/sap\/bc\/adt\/[^"<\s]+/g) || [];
            
            if (rawUris.length === 0) {
                return { content: [{ type: "text", text: "No ADT URIs found in input." }] };
            }
    
            // Чистим от якорей (#), если они есть, и убираем дубликаты
            const cleanUris = [...new Set(rawUris.map(uri => uri.split('#')[0]))];
    
            const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
    <usageSnippetRequest xmlns="http://www.sap.com/adt/ris/usageReferences" includeContext="true" contextLength="160">
      <objectIdentifiers>
    ${cleanUris.map(uri => `    <objectIdentifier>${uri}</objectIdentifier>`).join('\n')}
      </objectIdentifiers>
    </usageSnippetRequest>`;
    
            const response = await makeAdtRequest(
                "/sap/bc/adt/repository/informationsystem/usageSnippets?includeContext=true&contextLength=160",
                'POST',
                30000,
                xmlBody,
                {},
                {
                    'Content-Type': 'application/vnd.sap.adt.repository.usagesnippets.request.v1+xml',
                    'Accept': 'application/vnd.sap.adt.repository.usagesnippets.result.v1+xml'
                }
            );
    
            return return_response(response);
        } catch (error: any) {
            return return_error(error);
        }
    }



/*
    async handleUsageReferenceSnippets(args: any): Promise<any> {
        try {
            const inputString = JSON.stringify(args);
            
            const uris = inputString.match(/\/sap\/bc\/adt\/[^"<\s]+(?:\/source\/main|\/includes\/[^"<\s]+)/g) || [];
            
            if (uris.length === 0) {
                return { content: [{ type: "text", text: "No source URIs found in the input." }] };
            }
    
            const uniqueUris = [...new Set(uris)].slice(0, 5); // Ограничимся 5 для скорости
            const results = [];
    
            for (const uri of uniqueUris) {
                try {
                  
                    const response = await makeAdtRequest(
                        uri,
                        'GET',
                        15000,
                        null,
                        {},
                        { 'Accept': 'text/plain' }
                    );
                    
                    if (response && response.data) {
                        results.push(`--- Source: ${uri} ---\n${response.data.slice(0, 1000)}...\n`);
                    }
                } catch (e: any) {
                    results.push(`Error loading ${uri}: ${e.message}`);
                }
            }
    
            return {
                content: [{ type: "text", text: results.join('\n\n') }]
            };
        } catch (error: any) {
            return { content: [{ type: "text", text: `Error: ${error.message}` }] };
        }
    }
   
*/



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