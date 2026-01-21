import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';

export class GeneralInfoHandler extends BaseHandler {
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
            await this.adtclient.login();
            const result = await this.adtclient.annotationDefinitions();
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
                `Failed to get annotation definitions: ${error.message || 'Unknown error'}`
            );
        }
    }

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
}