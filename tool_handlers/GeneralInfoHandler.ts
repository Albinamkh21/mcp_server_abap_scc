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

export class GeneralInfoHandler  {
    getTools(): ToolDefinition[] {
        return [
            {
                name: 'getAllAnnotations',
                description: 'Get definitions of all standard annotations',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'getAllObjectTypes',
                description: 'Get all standard object types',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            }
        ];
    }

    async handle(toolName: string, args: any): Promise<any> {
        switch (toolName) {
            case 'getAllAnnotations':
                return this.handleAnnotationDefinitions(args);
            case 'getAllObjectTypes':
                return this.handleObjectTypes(args);
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown DDIC tool: ${toolName}`);
        }
    }

    async handleAnnotationDefinitions(args: any): Promise<any> {
        const startTime = performance.now();
        try {
           
            const discoveryResponse = await makeAdtRequest('/sap/bc/adt/discovery', 'GET', 30000);
            const discoveryXml = discoveryResponse.data;
    
          
            let annotationUrl = '';
            
       
            const match = discoveryXml.match(/<app:collection[^>]*href="([^"]*annotation[^"]*)"[^>]*>/);
            
            if (match && match[1]) {
                annotationUrl = match[1];
            } else {
         
                annotationUrl = '/sap/bc/adt/ddic/ddl/annotations';
            }
    
            
            const response = await makeAdtRequest(
                annotationUrl, 
                'GET', 
                30000, 
                undefined, 
                {}, 
                {
                  'Accept': 'application/vnd.sap.adt.ddic.ddl.annotations.v1+xml, application/vnd.sap.adt.repository.annotations.v1+xml, application/xml'
                }
            );
    
            
            return return_response(response); 
    
        } catch (error: any) {
          
            return return_error(error);
        }
    }

    async handleObjectTypes(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const url = `/sap/bc/adt/runtime/traces/abaptraces/objecttypes`;
    
            const response = await makeAdtRequest(
                url, 
                'GET',
                30000,
                undefined,
                {},
                {
                    'Accept': 'application/xml, text/xml'
                }
            );
    
            return return_response(response,transformNamedItems); 
        } catch (error: any) {
           
            return return_error(error);
        }
    }

/*
    async handleObjectTypes(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            await this.adtclient.login();
            const types = await this.adtclient.objectTypes();
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            types,
                            message: 'Object types retrieved successfully'
                        }, null, 2)
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            const errorMessage = error.message || 'Unknown error';
            const detailedError = error.response?.data?.message || errorMessage;
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get object types: ${detailedError}`
            );
        }
    }

    */
}