import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';

export class ReferenceHandler extends BaseHandler {
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
        const startTime = performance.now();
        try {
            await this.adtclient.login();
            const result = await this.adtclient.usageReferences(
                args.objectUrl
            );
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
                `Usage references failed: ${error.message || 'Unknown error'}`
            );
        }
    }


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
}