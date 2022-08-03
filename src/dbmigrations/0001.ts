import * as db from '../db';

export async function apply() {
    const database = await db.getDatabase();
    await database.createCollection('dbmigration', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['current'],
                additionalProperties: false,
                properties: {
                    _id: {},
                    current: {
                        bsonType: 'int',
                        description: 'must be a number and is required'
                    }
                }
            }
        }
    });
    const migrationCollection = await db.getCollection('dbmigration');
    await migrationCollection?.insertOne({ current: 0 });
}
