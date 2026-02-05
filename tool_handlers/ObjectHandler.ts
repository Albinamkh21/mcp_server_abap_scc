    import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
    import { BaseHandler } from './BaseHandler.js';
    import type { ToolDefinition } from '../types/tools.js';
    import { 
        makeAdtRequest, 
        return_error, 
        return_response, 
        transformSearchResults, 
        transformAbapSource,
        transformObjectMeta,
        transformInterfaceDefinition,
        transformPackageInfo,
        transformTransactionInfo,
        xmlArray 
    } from '../utils/utils.js';

    export class ObjectHandler   {
        getTools(): ToolDefinition[] {
            return [
                {
                    name: 'getObjects',
                    description: 'Get objects by regex query. Returns objectURL',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: 'Search query string'
                            }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'getObjectStructure',
                    description: 'Retrieves technical metadata and structural components of an ABAP object.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            objectUrl: {
                                type: 'string',
                                description: 'URL of the object'
                            }
                        },
                        required: ['objectUrl']
                    }
                },
                {
                    name: 'getObjectSourceCode',
                    description: 'Retrieves source code for a ABAP object.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            objectUrl: { type: 'string' }
                        },
                        required: ['objectUrl']
                    }
                },
                {
                    name: 'getObjectFullPath',
                    description: 'Retrieves the full hierarchical path of an ABAP object.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            objectUrl: {
                                type: 'string',
                                description: 'URL of the object to find path for'
                            }
                        },
                        required: ['objectUrl']
                    }
                },
                {
                    name: 'getObjectVersionHistory',
                    description: 'Retrieves version history for a specific object.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            objectUrl: {
                                type: 'string',
                                description: 'The URL of the object.'
                            }
                        },
                        required: ['objectUrl']
                    }
                },
                {
                    name: 'getPackageObjects',
                    description: 'Retrieves list of objects inside of package',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            package_name: {
                                type: 'string',
                            }
                        },
                        required: ['package_name']
                    }
                },
                {
                    name: 'getFunction',
                    description: 'Get function code',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            function_name: {
                                type: 'string',
                            }, 
                            function_group: {
                                type: 'string',
                            }, 

                        },
                        required: ['function_name', 'function_group']
                    }

                },
                {
                    name: 'getFunctionGroup',
                    description: 'Get function group code',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            function_group: {
                                type: 'string',
                            }, 

                        },
                        required: ['function_name', 'function_group']
                    }

                },
                {
                    name: 'getInclude',
                    description: 'Get include',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            include_name: {
                                type: 'string',
                            }, 

                        },
                        required: ['include_name']
                    }

                },
                {
                    name: 'getInterface',
                    description: 'Get Interface  code',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            interface_name: {
                                type: 'string',
                            }, 

                        },
                        required: ['interface_name']
                    }

                },
                {
                    name: 'getProgram',
                    description: 'Get Program  code',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            program_name: {
                                type: 'string',
                            }, 

                        },
                        required: ['program_name']
                    }

                },
                {
                    name: 'getTransaction',
                    description: 'Get transaction  code',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            transaction_name: {
                                type: 'string',
                            }, 

                        },
                        required: ['transaction_name']
                    }

                }
            ];
        }

        async handle(toolName: string, args: any): Promise<any> {
            switch (toolName) {
                case 'getObjects':
                    return this.handleGetObjects(args);
                case 'getObjectStructure':
                    return this.handleObjectStructure(args);
                case 'getObjectSourceCode':
                    return this.handleGetObjectSourceCode(args);
            /* case 'getObjectFullPath':
                    return this.handleGetObjectPath(args);
                case 'getObjectVersionHistory':
                    return this.handleObjectVersionHistory(args);*/
                case 'getPackageObjects':
                    return this.handlePackageObjects(args);
                case 'getFunction':
                    return this.handleGetFunction(args);    
                case 'getFunctionGroup':
                        return this.handleGetFunctionGroup(args);    
                case 'getInclude':
                    return this.handleGetInclude(args);    
                case 'getInterface':
                        return this.handleGetInterface(args);     
                case 'getProgram':
                        return this.handleGetProgram(args);      
                case 'getTransaction':
                            return this.handleGetTransaction(args);          
                                    
                default:
                    throw new McpError(ErrorCode.MethodNotFound, `Unknown object tool: ${toolName}`);
            }
        }

        async handleGetObjects(args: any): Promise<any> {
            try {
                if (!args?.query) {
                    throw new McpError(ErrorCode.InvalidParams, 'Search query is required');
                }
                const query = args.query.replace(/\.\*/g, '*');
                const maxResults = args.maxResults || 100;
                const encodedQuery = encodeURIComponent(query);
                const url = `/sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=${encodedQuery}&maxResults=${maxResults}`;
                const response = await makeAdtRequest(url, 'GET', 30000);
                return return_response(response, transformSearchResults);
            } catch (error) {
                return return_error(error);
            }
        }

        async handleObjectStructure(args: any): Promise<any> {
            try {
                if (!args?.objectUrl) {
                    throw new McpError(ErrorCode.InvalidParams, 'Object URL is required');
                }
                const url = args.objectUrl;
                const response = await makeAdtRequest(url, 'GET', 30000);
                return return_response(response, transformObjectMeta);
            } catch (error) {
                return return_error(error);
            }
        }

        async handleGetObjectSourceCode(args: any): Promise<any> {
            try {
                if (!args?.objectUrl) {
                    throw new McpError(ErrorCode.InvalidParams, 'Object URL is required');
                }
                const sourceUrl = args.objectUrl.includes('/source/main') ? args.objectUrl : `${args.objectUrl}/source/main`;
                const url = `${sourceUrl}`;
                const response = await makeAdtRequest(url, 'GET', 30000, undefined, {}, {'Accept': 'text/plain'});
                return return_response(response, transformAbapSource);
            } catch (error) {
                return return_error(error);
            }
        }
    /*
        async handleGetObjectPath(args: any): Promise<any> {
            const startTime = performance.now();
            try {
                await this.adtclient.login();
                const path = await this.adtclient.findObjectPath(args.objectUrl);
                this.trackRequest(startTime, true);
        
                if (!path || path.length === 0) return "Path not found";
                
                return path
                    .map((p: any) => `${p['adtcore:name']} (${p['adtcore:type']})`)
                    .join(' > ');
            } catch (error: any) {
                this.trackRequest(startTime, false);
                throw new McpError(ErrorCode.InternalError, `Failed to find path: ${error.message}`);
            }
        }

        async handleObjectVersionHistory(args: any): Promise<any> {
            const startTime = performance.now();
            try {
                await this.adtclient.login();
                const revisions = await this.adtclient.revisions(args.objectUrl);
                this.trackRequest(startTime, true);
        
                if (!revisions || revisions.length === 0) return "No version history found.";
        
                return revisions.map((rev: any) => {
                    return `Version: ${rev.version} | Author: ${rev.author} | Date: ${rev.date}\n  URL: ${rev.uri}`;
                }).join('\n---\n');
            } catch (error: any) {
                this.trackRequest(startTime, false);
                throw new McpError(ErrorCode.InternalError, `Failed to get versions: ${error.message}`);
            }
        }
    
    */

        async  handlePackageObjects(args: any) {
            try {
                if (!args?.package_name) {
                    throw new McpError(ErrorCode.InvalidParams, 'Package name is required');
                }
        
                const nodeContentsUrl = `/sap/bc/adt/repository/nodestructure`;
                const encodedPackageName = encodeURIComponent(args.package_name);
                const nodeContentsParams = {
                    parent_type: "DEVC/K",
                    parent_name: encodedPackageName,
                    withShortDescriptions: true
                };
        
                const package_structure_response = await makeAdtRequest(nodeContentsUrl, 'POST', 30000, undefined, nodeContentsParams);
                return return_response(package_structure_response, transformPackageInfo);
        
            } catch (error) {
                return return_error(error);
            }
        }

        async  handleGetFunction(args: any) {
            try {
                if (!args?.function_name || !args?.function_group) {
                    throw new McpError(ErrorCode.InvalidParams, 'Function name and group are required');
                }
                const encodedFunctionName = encodeURIComponent(args.function_name);
                const encodedFunctionGroup = encodeURIComponent(args.function_group);
                const url = `/sap/bc/adt/functions/groups/${encodedFunctionGroup}/fmodules/${encodedFunctionName}/source/main`;
                const response = await makeAdtRequest(url, 'GET', 30000, undefined, {}, {'Accept': 'text/plain'});
                return return_response(response); // Remove transformer - returns raw function source
            } catch (error) {
                return return_error(error);
            }
        }
        async  handleGetFunctionGroup(args: any) {
            try {
                if (!args?.function_group) {
                    throw new McpError(ErrorCode.InvalidParams, 'Function Group is required');
                }
                const encodedFunctionGroup = encodeURIComponent(args.function_group);
                const url = `/sap/bc/adt/functions/groups/${encodedFunctionGroup}/source/main`;
                const response = await makeAdtRequest(url, 'GET', 30000, undefined, {}, {'Accept': 'text/plain'});
                return return_response(response); // Remove transformer - returns raw function group source
            } catch (error) {
                return return_error(error);
            }
        }
        async  handleGetInclude(args: any) {
            try {
                if (!args?.include_name) {
                    throw new McpError(ErrorCode.InvalidParams, 'Include name is required');
                }
                const encodedIncludeName = encodeURIComponent(args.include_name);
                const url = `/sap/bc/adt/programs/includes/${encodedIncludeName}/source/main`;
                const response = await makeAdtRequest(url, 'GET', 30000, undefined, {}, {'Accept': 'text/plain'});
                return return_response(response); // Remove transformer - returns raw include source
            } catch (error) {
                return return_error(error);
            }
        }
        async  handleGetInterface(args: any) {
            try {
                if (!args?.interface_name) {
                    throw new McpError(ErrorCode.InvalidParams, 'Interface name is required');
                }
                const encodedInterfaceName = encodeURIComponent(args.interface_name);
                const url = `/sap/bc/adt/oo/interfaces/${encodedInterfaceName}/source/main`;
                const response = await makeAdtRequest(url, 'GET', 30000);
                return return_response(response, transformInterfaceDefinition);
            } catch (error) {
                return return_error(error);
            }
        }
        async  handleGetProgram(args: any) {
            try {
                if (!args?.program_name) {
                    throw new McpError(ErrorCode.InvalidParams, 'Program name is required');
                }
                const encodedProgramName = encodeURIComponent(args.program_name);
                const url = `/sap/bc/adt/programs/programs/${encodedProgramName}/source/main`;
        
                const response = await makeAdtRequest(url, 'GET', 30000, undefined, {}, {'Accept': 'text/plain'});
                return return_response(response); // Remove transformer - returns raw source code
            }
            catch (error) {
                return return_error(error);
            }
        }

        async  handleGetTransaction(args: any) {
            try {
                if (!args?.transaction_name) {
                    throw new McpError(ErrorCode.InvalidParams, 'Transaction name is required');
                }
                const encodedTransactionName = encodeURIComponent(args.transaction_name);
                const url = `/sap/bc/adt/repository/informationsystem/objectproperties/values?uri=%2Fsap%2Fbc%2Fadt%2Fvit%2Fwb%2Fobject_type%2Ftrant%2Fobject_name%2F${encodedTransactionName}&facet=package&facet=appl`;
                const response = await makeAdtRequest(url, 'GET', 30000, undefined, {}, {'Accept': 'application/vnd.sap.adt.repository.objproperties.result.v1+xml' });
                return return_response(response, transformTransactionInfo);
            } catch (error) {
                return return_error(error);
            }
        }







    }