const { GoogleAuth } = require('google-auth-library');
const config = require('./config');
const fs = require('fs');

class VertexRag {
    constructor() {
        this.auth = new GoogleAuth({
            keyFilename: config.GCP_KEY_FILE,
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });
        this.apiEndpoint = `https://${config.GCP_LOCATION}-aiplatform.googleapis.com/v1beta1`;
        this.parentPath = `projects/${config.GCP_PROJECT_ID}/locations/${config.GCP_LOCATION}`;
    }

    async getAccessToken() {
        const client = await this.auth.getClient();
        const token = await client.getAccessToken();
        return token.token;
    }

    async createCorpus(displayName) {
        const token = await this.getAccessToken();
        const response = await fetch(`${this.apiEndpoint}/${this.parentPath}/ragCorpora`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ displayName: displayName }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Vertex AI CreateCorpus Error: ${JSON.stringify(error)}`);
        }

        const operation = await response.json();
        const result = await this.waitOperation(operation.name);
        return result.name;
    }

    async waitOperation(operationName) {
        const token = await this.getAccessToken();
        const url = `${this.apiEndpoint}/${operationName}`;
        let isDone = false;
        let operation;
        while (!isDone) {
            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            operation = await response.json();
            if (operation.done) {
                isDone = true;
                if (operation.error) throw new Error(`Operation failed: ${JSON.stringify(operation.error)}`);
            } else {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        return operation.response;
    }

    async listCorpora() {
        const token = await this.getAccessToken();
        const response = await fetch(`${this.apiEndpoint}/${this.parentPath}/ragCorpora`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Vertex AI ListCorpora Error: ${JSON.stringify(error)}`);
        }
        const data = await response.json();
        return data.ragCorpora || [];
    }

    async uploadFile(corpusName, fileBuffer, fileName, description = '') {
        const token = await this.getAccessToken();
        const uploadUrl = `https://${config.GCP_LOCATION}-aiplatform.googleapis.com/upload/v1beta1/${corpusName}/ragFiles:upload`;
        const boundary = '----------' + Math.random().toString(16).substring(2);
        const metadata = JSON.stringify({
            ragFile: { displayName: fileName, description: description }
        });
        const body = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n${metadata}\r\n`),
            Buffer.from(`--${boundary}\r\nContent-Type: application/octet-stream\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\n\r\n`),
            fileBuffer,
            Buffer.from(`\r\n--${boundary}--\r\n`)
        ]);

        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Goog-Upload-Protocol': 'multipart',
                'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: body
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Vertex AI UploadFile Error: ${errorText}`);
        }
        const data = await response.json();
        return data.ragFile || data;
    }

    async retrieveContexts(corpusName, queryText, topK = 5) {
        const token = await this.getAccessToken();
        const response = await fetch(`${this.apiEndpoint}/${this.parentPath}:retrieveContexts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                vertex_rag_store: {
                    rag_resources: [{ rag_corpus: corpusName }]
                },
                query: {
                    text: queryText,
                    rag_retrieval_config: {
                        top_k: topK,
                        filter: { vector_distance_threshold: 0.5 }
                    }
                }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Vertex AI RetrieveContexts Error: ${errorText}`);
        }

        const data = await response.json();
        const contexts = data.contexts?.contexts || [];
        return contexts.map(c => ({
            text: c.text,
            score: c.score || c.distance,
            source: c.sourceDisplayName
        }));
    }

    async deleteCorpus(corpusName) {
        const token = await this.getAccessToken();
        const response = await fetch(`${this.apiEndpoint}/${corpusName}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok && response.status !== 404) {
            const error = await response.text();
            throw new Error(`Vertex AI DeleteCorpus Error: ${error}`);
        }
        return true;
    }

    async listFiles(corpusName) {
        const token = await this.getAccessToken();
        const response = await fetch(`${this.apiEndpoint}/${corpusName}/ragFiles`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Vertex AI ListFiles Error: ${error}`);
        }
        const data = await response.json();
        return data.ragFiles || [];
    }

    async deleteFile(ragFileName) {
        const token = await this.getAccessToken();
        const response = await fetch(`${this.apiEndpoint}/${ragFileName}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok && response.status !== 404) {
            const error = await response.text();
            throw new Error(`Vertex AI DeleteFile Error: ${error}`);
        }
        return true;
    }
}

module.exports = new VertexRag();
