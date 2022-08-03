import * as mongodb from 'mongodb';

const mongoClient: mongodb.MongoClient = new mongodb.MongoClient(process.env.MONGO_URL!);
const mapDatabase = new Map<string, mongodb.Db>();
const mapCollections = new Map<string, Map<string, mongodb.Collection>>();

export const connect = async () => {
    await mongoClient.connect();
};

export const getClient = async (): Promise<mongodb.MongoClient> => {
    return mongoClient;
};

export const getDatabase = async (databaseName?: string): Promise<mongodb.Db> => {
    if (!databaseName) {
        databaseName = 'cion';
    }
    if (!mapDatabase.has(databaseName)) {
        mapDatabase.set(databaseName, mongoClient.db(databaseName));
        mapCollections.set(databaseName, new Map<string, mongodb.Collection>());
    }
    const database = mapDatabase.get(databaseName);
    return database!;
};

export const getCollection = async (
    collectionName: string,
    databaseName?: string
): Promise<mongodb.Collection | undefined> => {
    const database = await getDatabase(databaseName);
    databaseName = database.databaseName;
    if (!mapCollections.get(databaseName)?.has(collectionName)) {
        if (!(await (await database.listCollections({ name: collectionName })).hasNext())) {
            return undefined;
        }
        const collection = database.collection(collectionName);
        mapCollections.get(databaseName)?.set(collectionName, collection!);
        return collection!;
    }
    const collection = mapCollections.get(databaseName)?.get(collectionName);
    return collection!;
};
