import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';
import { 
    makeAdtRequest, 
    return_response, 
    return_error, 
    transformPackageInfo,
    transformStructureDefinition, 
    transformTableContents,
    transformTypeInfo       
} from '../utils/utils.js';

export class DdicHandler  {
    getTools(): ToolDefinition[] {
        return [
            {
                name: 'getDdicElementDetails',
                description: 'Retrieves technical structure and metadata of ABAP Dictionary object (Table, Structure, or View). Returns the objects core properties, list of its fields (children) with details.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        structure_name: {
                            type: 'string',
                            description: 'Structure name',
                            optional: true
                        }
                    },
                    required: ['structure_name']
                }
            },
            {
                name: 'getTable',
                description: 'Get table infornation.  Fields, keys, data types, include structures, technical settings (partially)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        table_name: {
                            type: 'string',
                            description: 'Table name',
                            optional: true
                        }
                    },
                    required: ['table_name']
                }
            },
            {
                name: 'getTypeInfo',
                description: 'Retrieves metadata of an ABAP data type by name. Returns the definition of a Domain or Data Element, including type, length, description, and fixed values if applicable.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        type_name: {
                            type: 'string',
                            description: 'Type name',
                            optional: true
                        }
                    },
                    required: ['type_name']
                }
            },
            {
                name: 'getPackagesByName',
                description: 'Performs a search for development packages with an optional name mask. Returns a list of package names and descriptions.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Package name query',
                            optional: true
                        }
                    },
                    required: ['name']
                }
            },
            {
                name: 'getTableContent',
                description: 'Retrieves the contents of an ABAP table/view',
                inputSchema: {
                    type: 'object',
                    properties: {
                        table_name: {
                            type: 'string',
                            description: 'The name of the DDIC entity (table or view)'
                        },
                        maxRows: {
                            type: 'number',
                            description: 'The maximum number of rows to retrieve.',
                            optional: true
                        },
                  
                    },
                    required: ['table_name']
                }
            },
            {
                name: 'runSqlQuery',
                description: 'Runs a SQL query on the target system.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        sqlQuery: {
                            type: 'string',
                            description: 'The SQL query to execute.'
                        },
                        rowNumber: {
                            type: 'number',
                            description: 'The maximum number of rows to retrieve.',
                            optional: true
                        },
                        decode: {
                            type: 'boolean',
                            description: 'Whether to decode the data.',
                            optional: true
                        }
                    },
                    required: ['sqlQuery']
                }
            }
        ];
    }

    async handle(toolName: string, args: any): Promise<any> {
        switch (toolName) {
            case 'getDdicElementDetails':
                return this.handleDdicElement(args);
            case 'getTable':
                return this.handleGetTable(args);   
            case 'getTypeInfo':
                return this.handleGetTypeInfo(args);  
            case 'getPackagesByName':
                return this.handleGetPackages(args);
            case 'getTableContent':
                return this.handleTableContents(args);
            case 'runSqlQuery':
                return this.handleRunQuery(args);
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown DDIC tool: ${toolName}`);
        }
    }

    async handleDdicElement(args: any): Promise<any> {
        try {
            if (!args?.structure_name) {
                throw new McpError(ErrorCode.InvalidParams, 'Structure name is required');
            }
            const encodedStructureName = encodeURIComponent(args.structure_name);
            const url = `/sap/bc/adt/ddic/structures/${encodedStructureName}/source/main`;
            
            const response = await makeAdtRequest(url, 'GET', 30000, undefined, {}, { 'Accept': 'text/plain'});
            return return_response(response); // Remove transformer - returns raw structure definition
        } catch (error) {
            return return_error(error);
        }
    }
    async handleGetTable(args: any) {
        
        try {
            if (!args?.table_name) {
                throw new McpError(ErrorCode.InvalidParams, 'Table name is required');
            }
            const encodedTableName = encodeURIComponent(args.table_name);
            const url = `/sap/bc/adt/ddic/tables/${encodedTableName}/source/main`;
            const response = await makeAdtRequest(url, 'GET', 30000, undefined, {}, {'Accept': 'text/plain'});
            return return_response(response); // Remove transformer - returns raw table definition
        } catch (error) {
            return return_error(error);
        }
    }

/*
    async handleDdicRepositoryAccess(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            await this.adtclient.login();
            const result = await this.adtclient.ddicRepositoryAccess(args.path);
            this.trackRequest(startTime, true);
            const mockResponse = { data: result } as any;
            return return_response(mockResponse);
        } catch (error: any) {
            this.trackRequest(startTime, false);
            return return_error(error);
        }
    }
*/
    async  handleGetPackages(args: any): Promise<any> {
        try {
            if (!args?.name) {
                throw new McpError(ErrorCode.InvalidParams, 'Package name is required');
            }
    
          
            const url = `/sap/bc/adt/repository/nodestructure`;
    
        
            const params = {
                parent_type: "DEVC/K",               
                parent_name: args.name.toUpperCase(), 
                withShortDescriptions: true          
            };
    
           
            const response = await makeAdtRequest(url, 'POST', 30000, undefined, params);
    
          
            return return_response(response, transformPackageInfo);
    
        } catch (error) {
            return return_error(error);
        }
    }

    async handleTableContents(args: any): Promise<any> {
        const tableName = args.table_name.toUpperCase();
        const maxRows = args.maxRows || 50;
    
        // Шлем ТОЛЬКО строку запроса, без XML-тегов
        const body = `SELECT * FROM ${tableName}`;
    
        const response = await makeAdtRequest(
            `/sap/bc/adt/datapreview/freestyle`,
            'POST',
            30000,
            body,
            { rowNumber: maxRows },
            { 'Content-Type': 'text/plain', 'Accept': 'application/xml' }
        );
    
        return { content: [{ type: "text", text: response.data }] };
    }


/*
    async  handleTableContents(args: any) {
        try {
            if (!args?.table_name) {
                throw new McpError(ErrorCode.InvalidParams, 'Table name is required');
            }
            const maxRows = args.max_rows || 100;
            const encodedTableName = encodeURIComponent(args.table_name);
            
            // NOTE: This service requires a custom SAP service implementation
            // You need to implement /z_mcp_abap_adt/z_tablecontent/ in your SAP system
            const url = `/z_mcp_abap_adt/z_tablecontent/${encodedTableName}?maxRows=${maxRows}`;
            const response = await makeAdtRequest(url, 'GET', 30000);
            return return_response(response); // Return raw response (likely JSON from custom service)
        } catch (error) {
            // Enhanced error message for GetTableContents since it requires custom implementation
            const errorMsg = `GetTableContents requires custom SAP service '/z_mcp_abap_adt/z_tablecontent/'. Original error: ${error}`;
            return return_error(new Error(errorMsg));
        }
}
*/

async handleRunQuery(args: { sqlQuery: string, rowNumber: number }): Promise<any> {
    try {
        if (!args?.sqlQuery) {
            throw new McpError(ErrorCode.InvalidParams, 'SQL query is required');
        }

        
        const url = `/sap/bc/adt/sqlscanner/queries`;
      
        const params = {
            rowNumber: args.rowNumber || 50
        };

        const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
            <sqlscanner:sqlQuery xmlns:sqlscanner="http://www.sap.com/adt/sqlscanner" xml:space="preserve">
                <query>${args.sqlQuery}</query>
            </sqlscanner:sqlQuery>`;

      
        const response = await makeAdtRequest(url, 'POST', 30000, xmlBody, params);
 
        return return_response(response);

    } catch (error) {
        return return_error(error);
    }
}


    async  handleGetTypeInfo(args: any) {
        try {
            if (!args?.type_name) {
                throw new McpError(ErrorCode.InvalidParams, 'Type name is required');
            }
        } catch (error) {
            return return_error(error);
        }
    
        const encodedTypeName = encodeURIComponent(args.type_name);
    
    
        try {
            const url = `/sap/bc/adt/ddic/domains/${encodedTypeName}/source/main`;
            const response = await makeAdtRequest(url, 'GET', 30000, undefined, {}, {'Accept': 'text/plain' });
            } catch (error) {
    
            
            try {
                const url = `/sap/bc/adt/ddic/dataelements/${encodedTypeName}`;
                const response = await makeAdtRequest(url, 'GET', 30000);
                return return_response(response, transformTypeInfo);
            } catch (error) {
                return return_error(error);
            }
    
        }
    }
}