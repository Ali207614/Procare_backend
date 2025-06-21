import * as hanaClient from '@sap/hana-client';
import * as fs from 'fs';
import * as path from 'path';
import { LoggerService } from '../logger/logger.service';

const logger = new LoggerService();

const connectionParams = {
    serverNode: process.env.SERVER_NODE,
    uid: process.env.UID,
    pwd: process.env.PASSWORD,
};

let globalConnection: hanaClient.Connection | null = null;


export function connectToHana(): hanaClient.Connection {
    if (!globalConnection) {
        const connection = hanaClient.createConnection();
        connection.connect(connectionParams, (err: any) => {
            if (err) {
                logger.error('❌ SAP HANA ulanishda xatolik:', err);
            } else {
                logger.log('✅ SAP HANA ulanish muvaffaqiyatli amalga oshirildi');
            }
        });
        globalConnection = connection;
    }
    return globalConnection;
}

export async function executeParam(query: string, params: any[] = []): Promise<any[]> {
    const conn = connectToHana();
    return new Promise((resolve, reject) => {
        conn.exec(query, params, (err: any, rows: any) => {
            if (err) {
                logger.error('❌ SAP HANA exec error:', err);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}


export async function executeOnce(query: string, params: any[] = []): Promise<any[]> {
    const tempConn = hanaClient.createConnection();
    return new Promise((resolve, reject) => {
        tempConn.connect(connectionParams, (err: any) => {
            if (err) {
                logger.error('❌ SAP HANA one-time connection error:', err);
                return reject(err);
            }

            tempConn.exec(query, params, (err: any, rows: any) => {
                tempConn.disconnect();

                if (err) {
                    logger.error('❌ SAP HANA execOnce error:', err);
                    return reject(err);
                }

                resolve(rows);
            });
        });
    });
}


export async function executeFromSQLFile(fileName: string, params: any[] = []): Promise<any[]> {
    const filePath = path.join(__dirname, '../../../sql', fileName);
    const query = fs.readFileSync(filePath, 'utf-8');
    return executeParam(query, params);
}


export async function executeOnceFromSQLFile(fileName: string, params: any[] = []): Promise<any[]> {
    const filePath = path.join(__dirname, '../../../sql', fileName);
    const query = fs.readFileSync(filePath, 'utf-8');
    return executeOnce(query, params);
}

export function closeGlobalConnection(): void {
    if (globalConnection) {
        globalConnection.disconnect();
        logger.log('🔌 SAP HANA global ulanish uzildi');
        globalConnection = null;
    }
}
