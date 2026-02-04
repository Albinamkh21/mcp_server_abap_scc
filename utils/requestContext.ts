
import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
    jwt?: string;
}


export const requestContext = new AsyncLocalStorage<RequestContext>();