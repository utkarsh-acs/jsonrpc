import express, { Request, Response, Application } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import * as db from './db';
import * as dbmigrations from './dbmigrations';
import * as jsonRpcHandler from './jsonRpc/handler';

const app: Application = express();

app.use(cors());
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));

app.get('/', async (req: Request, res: Response) => {
    res.send('Welcome to Cion Digital API server. Please use HTTP POST request to communicate with this server.');
});

app.post('/', async (req: Request, res: Response) => {
    try {
        const response = await jsonRpcHandler.handle(req.body);
        res.json(response);
    } catch (err) {
        if (err instanceof jsonRpcHandler.InvalidRequest) {
            res.status(400).send(err.message);
        } else {
            res.sendStatus(500);
        }
    }
});

(async () => {
    try {
        await db.connect();
        if (!(await dbmigrations.apply())) {
            return;
        }
        app.listen(3000, (): void => {
            console.log('backend started');
        });
    } catch (err) {
        console.log(err);
    }
})();
