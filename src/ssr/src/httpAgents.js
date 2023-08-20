"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpAgentsConfig = void 0;
const agentkeepalive_1 = __importDefault(require("agentkeepalive"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const keepAliveConfig = {
    maxSockets: 200,
    maxFreeSockets: 20,
    timeout: 240 * 1000,
    freeSocketTimeout: 240 * 1000,
};
const httpAgent = new agentkeepalive_1.default(keepAliveConfig);
const httpsAgent = new agentkeepalive_1.default.HttpsAgent(keepAliveConfig);
exports.httpAgentsConfig = {
    setUpDefaultAgents: (serverBundle) => {
        http_1.default.globalAgent = httpAgent;
        https_1.default.globalAgent = httpsAgent;
        if (serverBundle.setUpDefaultAgents) {
            serverBundle.setUpDefaultAgents(httpAgent, httpsAgent);
        }
    },
    /**
     * Enable connection pooling. Adds `connection: keep-alive` header
     * @param {string} url api host
     */
    getAgent: (url) => {
        if (!url) {
            throw new Error('[KEEP-ALIVE-CONFIG] SITECORE_API_HOST value is required, but was undefined');
        }
        if (!url.indexOf('http://'))
            return httpAgent;
        if (!url.indexOf('https://'))
            return httpsAgent;
        throw new Error('[KEEP-ALIVE-CONFIG] Unexpected SITECORE_API_HOST value, expected http:// or https://, but was ' +
            url);
    },
};
