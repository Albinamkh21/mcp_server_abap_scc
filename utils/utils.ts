import dotenv from 'dotenv';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { Agent } from 'https';
import { AxiosResponse } from 'axios';
import convert from 'xml-js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { executeHttpRequest, HttpResponse } from '@sap-cloud-sdk/http-client';
import { xml2js } from 'xml-js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export interface UniversalResponse {
    data: any;
    headers?: any;
    status?: number;
}
// Interface for SAP configuration
export interface SapConfig {
    url: string;
    username: string;
    password: string;
    client: string;
  }
  
  /**
   * Retrieves SAP configuration from environment variables.
   *
   * @returns {SapConfig} The SAP configuration object.
   * @throws {Error} If any required environment variable is missing.
   */
  export function getConfig(): SapConfig {
    const url = process.env.SAP_URL;
    const username = process.env.SAP_USER;
    const password = process.env.SAP_PASSWORD;
    const client = process.env.SAP_CLIENT;
  
    // Check if all required environment variables are set
    if (!url || !username || !password || !client) {
      throw new Error(`Missing required environment variables. Required variables:
  - SAP_URL
  - SAP_USER
  - SAP_PASSWORD
  - SAP_CLIENT`);
    }
  
    return { url, username, password, client };
  }
export { McpError, ErrorCode, AxiosResponse };

export function return_response(response: UniversalResponse, jsonTransformer?: (data: any) => any) {
    // Check if RETURN_RAW_XML environment variable is set to true
    const returnRawXml = process.env.RETURN_RAW_XML === 'true';
    
    // If raw XML is requested AND there's a transformer (XML API), return raw XML
    if (returnRawXml && jsonTransformer) {
        return {
            isError: false,
            content: [{
                type: 'text',
                text: response.data
            }]
        };
    }
    
    // If a JSON transformer is provided, parse the XML and transform it
    if (jsonTransformer) {
        try {
            const parsed = fullParse(response.data);
            const transformed = jsonTransformer(parsed);
            return {
                isError: false,
                content: [{
                    type: 'text',
                    text: JSON.stringify(transformed, null, 2)
                }]
            };
        } catch (error) {
            // If transformation fails, fall back to raw response
            return {
                isError: false,
                content: [{
                    type: 'text',
                    text: response.data
                }]
            };
        }
    }
    
    // Default behavior: return raw response (for string APIs)
    return {
        isError: false,
        content: [{
            type: 'text',
            text: response.data
        }]
    };
}
export function return_error(error: any) {

    const errorData = error.response?.data || error.cause?.response?.data;
    const errorMessage = error.message || String(error);

    return {
        isError: true,
        content: [{
            type: 'text',
            text: `Error: ${errorData ? (typeof errorData === 'object' ? JSON.stringify(errorData) : errorData) : errorMessage}`
        }]
    };
}
let axiosInstance: AxiosInstance | null = null;
export function createAxiosInstance() {
    if (!axiosInstance) {
        axiosInstance = axios.create({
            httpsAgent: new Agent({
                rejectUnauthorized: false // Allow self-signed certificates
            })
        });
    }
    return axiosInstance;
}

// Cleanup function for tests
export function cleanup() {
    if (axiosInstance) {
        // Clear any interceptors
        const reqInterceptor = axiosInstance.interceptors.request.use((config) => config);
        const resInterceptor = axiosInstance.interceptors.response.use((response) => response);
        axiosInstance.interceptors.request.eject(reqInterceptor);
        axiosInstance.interceptors.response.eject(resInterceptor);
    }
    axiosInstance = null;
    config = undefined;
    csrfToken = null;
    cookies = null;
}

let config: SapConfig | undefined;
let csrfToken: string | null = null;
let cookies: string | null = null; // Variable to store cookies

export async function getBaseUrl() {
    if (!config) {
        config = getConfig();
    }
    const { url } = config;
    try {
        const urlObj = new URL(url);
        const baseUrl = Buffer.from(`${urlObj.origin}`);
        return baseUrl;
    } catch (error) {
        const errorMessage = `Invalid URL in configuration: ${error instanceof Error ? error.message : error}`;
        throw new Error(errorMessage);
    }
}

export async function getAuthHeaders() {
    if (!config) {
        config = getConfig();
    }
    const { username, password, client } = config;
    const auth = Buffer.from(`${username}:${password}`).toString('base64'); // Create Basic Auth string
    return {
        'Authorization': `Basic ${auth}`, // Basic Authentication header
        'X-SAP-Client': client            // SAP client header
    };
}

async function fetchCsrfToken(url: string): Promise<string> {
    try {
        const baseUrl = await getBaseUrl();
        const discoveryUrl = `${baseUrl}/sap/bc/adt/discovery`;
        const response = await createAxiosInstance()({
            method: 'GET', 
            url: discoveryUrl,
            headers: {
                ...(await getAuthHeaders()),
                'x-csrf-token': 'fetch'
            }
        });

        const token = response.headers['x-csrf-token'];
        if (!token) {
            throw new Error('No CSRF token in response headers');
        }

        // Extract and store cookies
        if (response.headers['set-cookie']) {
            cookies = response.headers['set-cookie'].join('; ');
        }

        return token;
    } catch (error) {
        // Even if the request fails, try to get token from error response
        if (error instanceof AxiosError && error.response?.headers['x-csrf-token']) {
            const token = error.response.headers['x-csrf-token'];
            if (token) {
                 // Extract and store cookies from the error response as well
                if (error.response.headers['set-cookie']) {
                    cookies = error.response.headers['set-cookie'].join('; ');
                }
                return token;
            }
        }
        // If we couldn't get token from error response either, throw the original error
        throw new Error(`Failed to fetch CSRF token: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function makeAdtRequest_local(path: string, method: string, timeout: number, data?: any, 
        params?: any, 
        customHeaders?: Record<string, string>) {
   
    const baseUrl = await getBaseUrl();
    const url = `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;

    // For POST/PUT requests, ensure we have a CSRF token
    if ((method === 'POST' || method === 'PUT') && !csrfToken) {
        try {
            csrfToken = await fetchCsrfToken(url);
        } catch (error) {
            throw new Error('CSRF token is required for POST/PUT requests but could not be fetched');
        }
    }

    const requestHeaders: Record<string, string> = {
        ...(await getAuthHeaders()),
        ...customHeaders
    };

    // Add CSRF token for POST/PUT requests
    if ((method === 'POST' || method === 'PUT') && csrfToken) {
        requestHeaders['x-csrf-token'] = csrfToken;
    }

    // Add cookies if available
    if (cookies) {
        requestHeaders['Cookie'] = cookies;
    }

    const config: any = {
        method,
        url,
        headers: requestHeaders,
        timeout,
        params: params
    };

    // Include data in the request configuration if provided
    if (data) {
        config.data = data;
    }

    try {
        const response = await createAxiosInstance()(config);
        return response;
    } catch (error) {
        // If we get a 403 with "CSRF token validation failed", try to fetch a new token and retry
        if (error instanceof AxiosError && error.response?.status === 403 &&
            error.response.data?.includes('CSRF')) {
            csrfToken = await fetchCsrfToken(url);
            config.headers['x-csrf-token'] = csrfToken;
            return await createAxiosInstance()(config);
        }
        throw error;
    }
}
async function makeAdtRequest_cloud(
    path: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE', 
    timeout: number, 
    data?: any, 
    params?: any,
    customHeaders?: Record<string, string>
) {
    return executeHttpRequest(
        { destinationName: process.env.DESTINATION_NAME || 'A4H_ADT' },
        {
            method: method,
            url: path,
            data: data,
            params: params, 
            timeout: timeout,
            headers: {
                'Accept': 'application/xml, application/json',
                'x-sap-adt-sessiontype': 'stateful',
                'Content-Type': typeof data === 'string' ? 'text/plain' : 'application/xml',
                ...customHeaders 
            }
        },
        { fetchCsrfToken: (method !== 'GET') }
    );
}
export async function makeAdtRequest(
    path: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE', 
    timeout: number, 
    data?: any, 
    params?: any,
    customHeaders?: Record<string, string>
) {
    const isCloud = process.env.CONNECTION_MODE === 'CLOUD';

    if (isCloud) {
        return makeAdtRequest_cloud(path, method, timeout, data, params, customHeaders);
    } else {
        return makeAdtRequest_local(path, method, timeout, data, params, customHeaders);
    }
}


// ===== CDS Utility Functions =====

/**
 * Base64 encoding function (Node.js equivalent of browser btoa)
 */
export function btoa(str: string): string {
    return Buffer.from(str, 'utf8').toString('base64');
}

/**
 * Format query string parameters
 */
export function formatQS(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach(v => searchParams.append(key, String(v)));
        } else if (value !== undefined && value !== null) {
            searchParams.append(key, String(value));
        }
    });
    
    return searchParams.toString();
}

/**
 * Full XML parse using xml-js library
 */
export function fullParse(xmlString: string): any {
    return convert.xml2js(xmlString, { compact: true });
}

/**
 * Navigate XML nodes safely
 */
export function xmlNode(obj: any, ...path: string[]): any {
    let current = obj;
    for (const key of path) {
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        } else {
            return undefined;
        }
    }
    return current?._text || current;
}

/**
 * Get XML node attributes
 */
export function xmlNodeAttr(obj: any): Record<string, string> {
    if (!obj || typeof obj !== 'object') return {};
    
    // Handle xml-js format with _attributes
    if (obj._attributes && typeof obj._attributes === 'object') {
        return { ...obj._attributes };
    }
    
    // Handle older format with @_ prefix
    const attrs: Record<string, string> = {};
    Object.keys(obj).forEach(key => {
        if (key.startsWith('@_')) {
            attrs[key.substring(2)] = obj[key];
        }
    });
    return attrs;
}

/**
 * Convert XML node to array format
 */
export function xmlArray(obj: any, ...path: string[]): any[] {
    const node = xmlNode(obj, ...path);
    if (!node) return [];
    return Array.isArray(node) ? node : [node];
}

/**
 * Check if value is an array
 */
export function isArray(value: any): value is any[] {
    return Array.isArray(value);
}

/**
 * Safe integer conversion
 */
export function toInt(value: any): number {
    const num = parseInt(String(value), 10);
    return isNaN(num) ? 0 : num;
}

// ===== SAP ADT Response Transformers =====

/**
 * Transform ABAP source code response to JSON
 */
export function transformAbapSource(parsed: any): any {
    const source = xmlNode(parsed, 'abapsource:abap');
    if (!source) return { source: parsed };
    
    return {
        type: 'abap_source',
        content: source,
        metadata: {
            contentType: xmlNodeAttr(parsed['abapsource:abap'])
        }
    };
}

/**
 * Transform search results to JSON
 */
export function transformSearchResults(parsed: any): any {
    const searchResult = parsed['adtcore:objectReferences'] || parsed;
    const objects = xmlArray(searchResult, 'adtcore:objectReference');
    
    if (objects.length === 0) {
        return "ERROR: Object not found";
    }

    // Берем только первый (самый релевантный) результат
    const attrs = objects[0]._attributes || {};
    const uri = attrs['adtcore:uri'] || '';

    // Возвращаем максимально плоский результат. 
    // Это именно то, что AI увидит в поле "text"
    return {
        uri: uri,
        pathForCode: `${uri}/source/main`
    };
}

/**
 * Transform table structure to JSON
 */
export function transformTableStructure(parsed: any): any {
    // Look for various possible root elements in table responses
    const tableInfo = parsed['ddic:table'] || parsed['table'] || parsed;
    
    return {
        type: 'table_structure',
        name: xmlNodeAttr(tableInfo)['name'] || 'unknown',
        description: xmlNodeAttr(tableInfo)['description'],
        content: typeof tableInfo === 'string' ? tableInfo : JSON.stringify(tableInfo, null, 2)
    };
}

/**
 * Transform class structure to JSON
 */
export function transformClassStructure(parsed: any): any {
    const classInfo = parsed['abapsource:abap'] || parsed;
    
    return {
        type: 'class_structure',
        content: typeof classInfo === 'string' ? classInfo : classInfo,
        metadata: {
            contentType: xmlNodeAttr(parsed['abapsource:abap'])
        }
    };
}

/**
 * Transform structure definition to JSON
 */
export function transformStructureDefinition(parsed: any): any {
    const structInfo = parsed['ddic:structure'] || parsed['structure'] || parsed;
    
    return {
        type: 'structure_definition',
        content: typeof structInfo === 'string' ? structInfo : structInfo,
        metadata: {
            contentType: xmlNodeAttr(structInfo)
        }
    };
}

/**
 * Transform function definition to JSON
 */
export function transformFunctionDefinition(parsed: any): any {
    const funcInfo = parsed['abapsource:abap'] || parsed;
    
    return {
        type: 'function_definition',
        content: typeof funcInfo === 'string' ? funcInfo : funcInfo,
        metadata: {
            contentType: xmlNodeAttr(parsed['abapsource:abap'])
        }
    };
}

/**
 * Transform package information to JSON
 */
export function transformPackageInfo(parsed: any): any {
    // Handle the specific format returned by the package service
    const nodes = parsed["asx:abap"]?.["asx:values"]?.DATA?.TREE_CONTENT?.SEU_ADT_REPOSITORY_OBJ_NODE || [];
    const extractedData = (Array.isArray(nodes) ? nodes : [nodes]).filter((node: any) => 
        node.OBJECT_NAME?._text && node.OBJECT_URI?._text
    ).map((node: any) => ({
        OBJECT_TYPE: node.OBJECT_TYPE._text,
        OBJECT_NAME: node.OBJECT_NAME._text,
        OBJECT_DESCRIPTION: node.DESCRIPTION?._text,
        OBJECT_URI: node.OBJECT_URI._text
    }));
    
    return {
        type: 'package_info',
        totalObjects: extractedData.length,
        objects: extractedData
    };
}

/**
 * Transform table contents to JSON
 */
/*
export function transformTableContents(parsed: any): any {
    const tableData = parsed['tableContents'] || parsed;
    
    return {
        type: 'table_contents',
        content: typeof tableData === 'string' ? tableData : tableData,
        metadata: {
            contentType: 'table_data'
        }
    };
}
    */

/**
 * Transform type information to JSON
 */
export function transformTypeInfo(parsed: any): any {
    const typeInfo = parsed['typeInfo'] || parsed;
    
    return {
        type: 'type_info',
        content: typeof typeInfo === 'string' ? typeInfo : typeInfo,
        metadata: {
            contentType: 'type_definition'
        }
    };
}

/**
 * Transform transaction information to JSON
 */
export function transformTransactionInfo(parsed: any): any {
    const transInfo = parsed['transaction'] || parsed;
    
    return {
        type: 'transaction_info',
        content: typeof transInfo === 'string' ? transInfo : transInfo,
        metadata: {
            contentType: 'transaction_definition'
        }
    };
}

/**
 * Transform interface definition to JSON
 */
export function transformInterfaceDefinition(parsed: any): any {
    const intfInfo = parsed['abapsource:abap'] || parsed;
    
    return {
        type: 'interface_definition',
        content: typeof intfInfo === 'string' ? intfInfo : intfInfo,
        metadata: {
            contentType: xmlNodeAttr(parsed['abapsource:abap'])
        }
    };
}

export function transformClassStructureClean(parsed: any): any {
    const root = parsed['abapsource:abap']?.['abapsource:objectStructureElement'] || 
                 parsed['abapsource:objectStructureElement'] || 
                 parsed;

    const className = root._attributes?.['adtcore:name'] || 'Unknown Class';
    
 
    const elements = xmlArray(root, 'abapsource:objectStructureElement');
    
    const components = elements.map((el: any) => {
        const attrs = el._attributes || {};
        const type = attrs['adtcore:type'] || '';
        
        return {
            name: attrs['adtcore:name'],
            // Типы в ADT: CLAS/OA = Attribute, CLAS/OM = Method, CLAS/OEE = Event и т.д.
            componentType: type.includes('/OA') ? 'Attribute' : 
                           type.includes('/OM') ? 'Method' : type,
            visibility: attrs['visibility'],
            level: attrs['level'], 
            isConstant: attrs['constant'] === 'true',
            description: attrs['adtcore:description'] || ''
        };
    }).filter(item => item.name); 

    return {
        type: 'class_structure',
        className: className,
        totalComponents: components.length,
        components: components
    };
}
export function transformObjectMeta(raw: any): any {

    const rootKey = Object.keys(raw).find(key => key.includes(':') || key === 'adtcore:object');
    const root = rootKey ? raw[rootKey] : raw;
    
    const attrs = root?._attributes || {};

    // Собираем универсальный "паспорт" объекта
    return {
        name: attrs['adtcore:name'] || 'Unknown',
        type: attrs['adtcore:type'],
        description: attrs['adtcore:description'],
        package: root['adtcore:packageRef']?._attributes?.['adtcore:name'],
        meta: {
            responsible: attrs['adtcore:responsible'],
            changedAt: attrs['adtcore:changedAt'],
            changedBy: attrs['adtcore:changedBy'],
            masterLanguage: attrs['adtcore:masterLanguage'],
            version: attrs['adtcore:version']
        }
    };
}


export function transformTableContents(parsed: any): any {
   
    const root = parsed['dataPreview:tableData'] || parsed;
    
    // Извлекаем массив колонок
    const columns = xmlArray(root, 'dataPreview:columns');
    
    if (!columns || columns.length === 0) {
        return {
            type: 'table_contents',
            rows: [],
            totalRows: 0
        };
    }

  
    // В xml-js (compact: true) :
    // col['dataPreview:metadata']._attributes.name
    // col['dataPreview:dataSet']['dataPreview:data'] -> массив значений или объект
    
    const table: any[] = [];
    const colNames: string[] = [];
    const colData: any[][] = [];

    columns.forEach((col: any) => {
        const meta = col['dataPreview:metadata']?._attributes || {};
        const name = meta['dataPreview:name'] || 'UNKNOWN';
        colNames.push(name);

    
        let dataEntries = col['dataPreview:dataSet']?.['dataPreview:data'];
        if (!dataEntries) {
            dataEntries = [];
        } else if (!Array.isArray(dataEntries)) {
            dataEntries = [dataEntries];
        }

        // Вытаскиваем текст из каждого элемента данных
        const values = dataEntries.map((d: any) => d._text || "");
        colData.push(values);
    });

    // Определяем количество строк (по первой колонке)
    const rowCount = colData[0]?.length || 0;

    // "Поворачиваем" данные из колонок в строки
    for (let i = 0; i < rowCount; i++) {
        const row: any = {};
        colNames.forEach((name, colIndex) => {
            row[name] = colData[colIndex][i];
        });
        table.push(row);
    }

    return {
        type: 'table_contents',
        totalRows: xmlNode(root, 'dataPreview:totalRows') || table.length,
        rows: table
    };
}




/**
 * Transform Named Item List (Object Types) to JSON
 */
export function transformNamedItems(parsed: any): any {
    const root = parsed['nameditem:namedItemList'] || parsed;
    const items = xmlArray(root, 'nameditem:namedItem');

    const result = items.map((item: any) => {
        return {
            // В этом формате данные лежат в текстовых узлах элементов
            name: item['nameditem:description']?._text || '',
            path: item['nameditem:name']?._text || '',
            // Извлекаем технический ID из конца пути (напр. 'report' или 'transaction')
            type: (item['nameditem:name']?._text || '').split('/').pop()?.toUpperCase()
        };
    }).filter(i => i.path);

    return {
        type: 'object_types',
        total: parseInt(root['nameditem:totalItemCount']?._text || '0'),
        types: result
    };
}
/*
export function transformTransportRequest(parsed: any): any {
    const root = parsed["tm:root"];
    if (!root) return [];

    const request = root["tm:request"];
    if (!request) return [];

    const allObjectsContainer = request["tm:all_objects"];
    if (!allObjectsContainer) return [];

    const rawObjects = allObjectsContainer["tm:abap_object"];
    if (!rawObjects) return [];

    const objectsArray = Array.isArray(rawObjects) ? rawObjects : [rawObjects];

    return objectsArray.map((obj: any) => {
        const attrs = obj["_attributes"] || {};

        return {
            // Используем wbtype (например, CLAS/OC), чтобы соответствовать пакетному выводу
            OBJECT_TYPE: attrs["tm:wbtype"] || attrs["tm:type"] || "",
            OBJECT_NAME: attrs["tm:name"] || "",
            // Оставляем описание, n8n ждет именно этот ключ
            DESCRIPTION: attrs["tm:obj_desc"] || "",
            OBJECT_URI:  attrs["tm:dummy_uri"] || "",
            PGMID:       attrs["tm:pgmid"] || ""
        };
    }).filter(item => item.OBJECT_NAME !== "");
}
    */

export function transformTransportRequest(parsed: any): any {
    const root = parsed["tm:root"];
    const request = root?.["tm:request"];
    const allObjects = request?.["tm:all_objects"];
    const rawItems = allObjects?.["tm:abap_object"];

    if (!rawItems) return [];

    const items = Array.isArray(rawItems) ? rawItems : [rawItems];

    return items.map((item: any) => {
        const attrs = item["_attributes"] || {};
        const name = (attrs["tm:name"] || "").toLowerCase();
        const type = attrs["tm:type"] || "";
        const wbtype = attrs["tm:wbtype"] || "";

        // Формируем прямой URI как в пакетах
        let adtUri = "";
        switch (type) {
            case 'CLAS': adtUri = `/sap/bc/adt/oo/classes/${name}`; break;
            case 'INTF': adtUri = `/sap/bc/adt/oo/interfaces/${name}`; break;
            case 'TABL': adtUri = `/sap/bc/adt/ddic/tables/${name}`; break;
            case 'DTEL': adtUri = `/sap/bc/adt/ddic/dataelements/${name}`; break;
            case 'TTYP': adtUri = `/sap/bc/adt/ddic/tabletypes/${name}`; break;
            case 'DEVC': adtUri = `/sap/bc/adt/packages/${name}`; break;
            default: adtUri = attrs["tm:dummy_uri"] || ""; // Если тип неизвестен
        }

        return {
            "OBJECT_TYPE": wbtype || type,
            "OBJECT_NAME": attrs["tm:name"] || "",
            "OBJECT_DESCRIPTION": attrs["tm:obj_desc"] || "",
            "OBJECT_URI": adtUri
        };
    }).filter(obj => obj.OBJECT_NAME !== "");
}