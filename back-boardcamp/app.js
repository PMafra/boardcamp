import express from "express";
import cors from "cors";
import Joi from "joi";
import pg from "pg";
import dayjs from "dayjs";

const app = express();
app.use(cors());
app.use(express.json());
const APP_PORT = 4000;

const { Pool } = pg;

const connection = new Pool({
    user: 'postgres',
    password: '123456',
    host: 'localhost',
    port: 5432,
    database: 'boardcamp'
});

// const userNameSchema = Joi.object().keys({
//     name: Joi.string().alphanum().min(3).max(30).required()
// });

// const messageSchema = Joi.object().keys({
//     to: Joi.string().alphanum().required(),
//     text: Joi.string().required(),
//     type: Joi.valid("message").valid("private_message")
// });

app.get('/categories', async (req, res) => {

    try {
        const categories = await connection.query(`
            SELECT * 
            FROM categories;
        `);
        if (categories.rows.length === 0) {
            return res.sendStatus(404);
        }
        res.send(categories.rows);
    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});

app.post('/categories', async (req, res) => {

    try {
        if (!req.body.name) {
            res.sendStatus(400);
            return;
        }

        const newCategory = req.body.name;

        const alreadyExists = await connection.query(`
            SELECT name 
            FROM categories 
            WHERE name = '${newCategory}';
        `);

        if (alreadyExists.rows.length !== 0) {
            res.sendStatus(409);
            return;
        }

        await connection.query(`
            INSERT INTO categories (name) 
            VALUES ('${newCategory}');
        `);

        res.sendStatus(201);
    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});

app.get('/games', async (req, res) => {

    try {
        const games = await connection.query(`
            SELECT games.*, 
                categories.name AS "categoryName" 
            FROM games 
            JOIN categories 
                ON games."categoryId" = categories.id
            ${req.query.name ? 
                `WHERE games.name iLIKE '${req.query.name}%'` 
                : ""}
            ;
        `);
        if (games.rows.length === 0) {
          return res.sendStatus(404);
        }
        res.send(games.rows);
    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});

app.post('/games', async (req, res) => {

    try {
        if (!req.body.name || req.body.stockTotal <= 0 || req.body.pricePerDay <= 0) {
            res.sendStatus(400);
            return;
        }

        const {
            name,
            image,
            stockTotal,
            categoryId,
            pricePerDay
        } = req.body;

        await connection.query(`
            INSERT INTO games (
                name, 
                image, 
                "stockTotal", 
                "categoryId", 
                "pricePerDay"
            ) VALUES (
                '${name}'
                ,'${image}'
                ,${stockTotal},
                ${categoryId},
                ${pricePerDay}
            );
        `);

        res.sendStatus(201);
    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});

app.get('/customers', async (req, res) => {

    try {
        const customers = await connection.query(`
            SELECT * FROM customers
            ${req.query.cpf ? 
                `WHERE customers.cpf LIKE '${req.query.cpf}%'` 
                : ""}
            ;
        `);
        if (customers.rows.length === 0) {
          return res.sendStatus(404);
        }
        res.send(customers.rows);
    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});

app.get('/customers/:id', async (req, res) => {

    try {
        const customer = await connection.query(`
            SELECT * FROM customers
            WHERE id = ${req.params.id}
            ;
        `);
        if (customer.rows.length === 0) {
          return res.sendStatus(404);
        }
        res.send(customer.rows);
    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});

app.post('/customers', async (req, res) => {

    try {
        if (!req.body.name || req.body.stockTotal <= 0 || req.body.pricePerDay <= 0) {
            res.sendStatus(400);
            return;
        }

        const {
            name,
            phone,
            cpf,
            birthday
        } = req.body;

        await connection.query(`
            INSERT INTO customers (
                name, 
                phone, 
                cpf, 
                birthday
            ) VALUES (
                '${name}'
                ,'${phone}'
                ,'${cpf}',
                '${birthday}'
            );
        `);

        res.sendStatus(201);
    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});

app.put('/customers/:id', async (req, res) => {

    try {

        const {
            name,
            phone,
            cpf,
            birthday
        } = req.body;
        await connection.query(`
            UPDATE customers 
            SET name = '${name}', 
                phone = '${phone}', 
                cpf = '${cpf}', 
                birthday = '${birthday}' 
            WHERE id = ${req.params.id};
        `);
        res.sendStatus(200);

    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});

app.get('/rentals', async (req, res) => {

    try {
        const rentals = await connection.query(`
            SELECT rentals.*,
                customers.id AS "customerId",
                customers.name AS "customerName",
                games.id AS "gameId",
                games.name AS "gameName",
                games."categoryId",
                categories.name AS "categoryName"
            FROM rentals
            JOIN customers
                ON rentals."customerId" = customers.id
            JOIN games
                ON rentals."gameId" = games.id
            JOIN categories
                ON games."categoryId" = categories.id
        ;
        `);
        console.log(rentals.rows)

        const newRentals = [];
        rentals.rows.map(rental => 
            newRentals.push({
                id: rental.id,
                customerId: rental.customerId,
                gameId: rental.gameId,
                rentDate: dayjs(rental.rentDate).format('YYYY/MM/DD').replace(/\//g,'-'),
                daysRented: rental. daysRented,
                returnDate: rental.returnDate,
                originalPrice: rental.originalPrice,
                delayFee: rental.delayFee,
                customer: {
                    id: rental.customerId,
                    name: rental.customerName
                },
                game: {
                    id: rental.gameId,
                    name: rental.gameName,
                    categoryId: rental.categoryId,
                    categoryName: rental.categoryName
                }
            })    
        );

        if (rentals.rows.length === 0) {
          return res.sendStatus(404);
        }

        res.send(newRentals);
    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});

app.post('/rentals', async (req, res) => {

    try {

        const {
            customerId,
            gameId,
            daysRented
        } = req.body;

        if (daysRented <= 0) {
            return res.sendStatus(400);
        }

        const pricePerDay = await connection.query(`
            SELECT games."pricePerDay"
            FROM games
            WHERE games.id = ${gameId};
        `)

        const rentDate = dayjs().format('YYYY/MM/DD').replace(/\//g,'-');

        await connection.query(`
            INSERT INTO rentals (
                "customerId", 
                "gameId", 
                "rentDate", 
                "daysRented",
                "returnDate",
                "originalPrice",
                "delayFee"
            ) VALUES (
                ${customerId},
                ${gameId},
                '${rentDate}',
                ${daysRented},
                ${null},
                ${daysRented * pricePerDay.rows[0].pricePerDay},
                ${null}
            );
        `);

        res.sendStatus(201);
    } catch (err) {
        res.sendStatus(500);
    }
});

app.listen(APP_PORT);