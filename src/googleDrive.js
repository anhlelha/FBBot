const { google } = require('googleapis');
const config = require('./config');

class GoogleDriveService {
    getOAuth2Client() {
        return new google.auth.OAuth2(config.GOOGLE_CLIENT_ID);
    }

    getDriveClient(accessToken) {
        const auth = this.getOAuth2Client();
        auth.setCredentials({ access_token: accessToken });
        return google.drive({ version: 'v3', auth });
    }

    async getFileMetadata(fileId, accessToken) {
        const drive = this.getDriveClient(accessToken);
        const res = await drive.files.get({
            fileId,
            fields: 'id, name, mimeType, size',
        });
        return res.data;
    }

    async downloadFile(fileId, accessToken) {
        const drive = this.getDriveClient(accessToken);
        const meta = await this.getFileMetadata(fileId, accessToken);

        const mimeType = meta.mimeType;
        let buffer;
        let filename = meta.name;

        // Google Workspace files need to be exported
        if (mimeType === 'application/vnd.google-apps.document') {
            const res = await drive.files.export(
                { fileId, mimeType: 'application/pdf' },
                { responseType: 'arraybuffer' }
            );
            buffer = Buffer.from(res.data);
            filename = filename.replace(/\.[^.]+$/, '') + '.pdf';
            if (!filename.endsWith('.pdf')) filename += '.pdf';
        } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
            const res = await drive.files.export(
                { fileId, mimeType: 'text/csv' },
                { responseType: 'arraybuffer' }
            );
            buffer = Buffer.from(res.data);
            filename = filename.replace(/\.[^.]+$/, '') + '.csv';
            if (!filename.endsWith('.csv')) filename += '.csv';
        } else if (mimeType === 'application/vnd.google-apps.presentation') {
            const res = await drive.files.export(
                { fileId, mimeType: 'application/pdf' },
                { responseType: 'arraybuffer' }
            );
            buffer = Buffer.from(res.data);
            filename = filename.replace(/\.[^.]+$/, '') + '.pdf';
            if (!filename.endsWith('.pdf')) filename += '.pdf';
        } else {
            // Regular file — download directly
            const res = await drive.files.get(
                { fileId, alt: 'media' },
                { responseType: 'arraybuffer' }
            );
            buffer = Buffer.from(res.data);

            const extMap = {
                'application/pdf': '.pdf',
                'text/plain': '.txt',
                'text/markdown': '.md',
                'text/csv': '.csv',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
            };
            if (extMap[mimeType] && !filename.toLowerCase().endsWith(extMap[mimeType])) {
                filename += extMap[mimeType];
            }
        }

        return {
            buffer,
            filename,
            size: buffer.length,
            originalMimeType: mimeType,
        };
    }
}

module.exports = new GoogleDriveService();
