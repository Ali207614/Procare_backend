import * as hanaClient from '@sap/hana-client';
import { LoggerService } from '../logger/logger.service';
import { HanaParameterType } from '@sap/hana-client';

const logger = new LoggerService();

const connectionParams = {
  serverNode: process.env.SERVER_NODE,
  uid: process.env.UID,
  pwd: process.env.PASSWORD,
};

export async function executeOnce<T = Record<string, unknown>>(
  query: string,
  params: HanaParameterType[] = [],
): Promise<T[]> {
  const tempConn: hanaClient.Connection = hanaClient.createConnection();

  return new Promise<T[]>((resolve, reject) => {
    tempConn.connect(connectionParams, (connectErr: Error | null) => {
      if (connectErr) {
        logger.error('❌ SAP HANA one-time connection error:', connectErr.message);
        return reject(connectErr);
      }

      tempConn.exec(query, params, (execErr: Error | null, rows: T[] | null) => {
        tempConn.disconnect();

        if (execErr) {
          logger.error('❌ SAP HANA execOnce error:', execErr.message);
          return reject(execErr);
        }

        resolve(rows ?? []);
      });
    });
  });
}
