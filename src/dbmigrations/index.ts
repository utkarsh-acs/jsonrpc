import fs from 'fs';
import path from 'path';
import * as url from 'url';
import * as mongodb from 'mongodb';
import * as db from '../db';

const currFolder = path.dirname(url.fileURLToPath(import.meta.url));

async function getCurrent(session?: mongodb.ClientSession): Promise<number> {
    const migrationCollection = await db.getCollection('dbmigration');
    if (!migrationCollection) return 0;
    const migrationRecords = await migrationCollection.find({}, session ? { session } : {});
    if (!(await migrationRecords.hasNext())) return 0;
    const migrationRecord = await migrationRecords.next();
    if (await migrationRecords.hasNext())
        throw Error(`[dbmigration] Error: multiple records in collection dbmigration`);
    return migrationRecord?.current;
}

async function setCurrent(current: number, session: mongodb.ClientSession) {
    const migrationCollection = await db.getCollection('dbmigration');
    await migrationCollection?.updateMany({}, { $set: { current } }, { session });
}

export async function apply() {
    const mongoClient = await db.getClient();
    const files: string[] = [];
    const pattern = /^[0-9]{4}\.ts$/;
    fs.readdirSync(currFolder).forEach((file) => {
        if (pattern.test(file)) {
            files.push(file);
        }
    });
    files.sort();
    const expectedMigrationNum = parseInt(files[files.length - 1].substring(0, 4));
    const currentFromDb = await getCurrent();
    if (expectedMigrationNum < currentFromDb) {
        console.log(
            `[dbmigration] expectedMigrationNum=${expectedMigrationNum} is less than currentFromDb=${currentFromDb}. Downgrading of database is not supported.`
        );
        return false;
    }
    for (let currentMigrationNum = currentFromDb; currentMigrationNum < expectedMigrationNum; currentMigrationNum++) {
        const nextMigrationFile = `${String(currentMigrationNum + 1).padStart(4, '0')}.ts`;
        console.log(`[dbmigration] ${nextMigrationFile} applying`);
        const imported = await import(`./${nextMigrationFile}`);
        let isMigrationApplied = false;
        const session = await mongoClient.startSession();
        try {
            const transactionResults = await session.withTransaction(async () => {
                if (currentMigrationNum !== (await getCurrent(session))) {
                    await session.abortTransaction();
                    return;
                }
                await imported.apply();
                await setCurrent(currentMigrationNum + 1, session);
            });
            if (transactionResults) {
                isMigrationApplied = true;
                console.log(`[dbmigration] ${nextMigrationFile} applied`);
            } else {
                console.log(`[dbmigration] ${nextMigrationFile} unable to apply, perhaps someone else applied it`);
            }
        } catch (err) {
            console.log(`[dbmigration] ${nextMigrationFile} error occured while applying`);
            console.log(err);
        } finally {
            await session.endSession();
        }
        if (!isMigrationApplied) {
            return false;
        }
    }
    return true;
}
