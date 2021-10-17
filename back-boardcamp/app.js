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

const newCategorySchema = Joi.object().length(1).keys({
    name: Joi.string().alphanum().min(1).max(30).required()
});

const newGameSchema = Joi.object().length(5).keys({
    name: Joi.string().min(1).max(30).required(),
    image: Joi.string().min(1).required(),
    stockTotal: Joi.number().integer().greater(0).required(),
    categoryId: Joi.number().integer().positive().required(),
    pricePerDay: Joi.number().integer().greater(0).required(),
});

const stringWithOnlyNumbers = /^[0-9]+$/;

const customerSchema = Joi.object().length(4).keys({
    name: Joi.string().min(1).max(30).required(),
    phone: Joi.string().min(10).max(11).pattern(stringWithOnlyNumbers).required(),
    cpf: Joi.string().length(11).pattern(stringWithOnlyNumbers).required(),
    birthday: Joi.date().required(),
});

// const messageSchema = Joi.object().keys({
//     to: Joi.string().alphanum().required(),
//     text: Joi.string().required(),
//     type: Joi.valid("message").valid("private_message")
// });

//CATEGORIES

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
        res.sendStatus(500);
    }
});

app.post('/categories', async (req, res) => {

    try {
        const isCorrectBody = newCategorySchema.validate(req.body);
        if (isCorrectBody.error) {
            return res.status(400).send(`Bad Request: ${isCorrectBody.error.details[0].message}`);
        }

        const newCategory = req.body.name;
        const isNewCategory = await connection.query(`
            SELECT name 
            FROM categories 
            WHERE name iLIKE '${newCategory}';
        `);

        if (isNewCategory.rows.length !== 0) {
            return res.status(409).send("This category already exists!");
        }

        await connection.query(`
            INSERT INTO categories (name) 
            VALUES ('${newCategory}');
        `);

        res.sendStatus(201);
    } catch (err) {
        res.sendStatus(500);
    }
});

//GAMES

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
                : ""};
        `);
        if (games.rows.length === 0) {
          return res.sendStatus(404);
        }
        res.send(games.rows);
    } catch (err) {
        res.sendStatus(500);
    }
});

app.post('/games', async (req, res) => {

    try {
        const isCorrectBody = newGameSchema.validate(req.body);
        if (isCorrectBody.error) {
            return res.status(400).send(`Bad Request: ${isCorrectBody.error.details[0].message}`);
        }

        const {
            name,
            image,
            stockTotal,
            categoryId,
            pricePerDay
        } = req.body;

        const isNewGame = await connection.query(`
            SELECT name 
            FROM games 
            WHERE name iLIKE '${name}';
        `);
        if (isNewGame.rows.length !== 0) {
            return res.status(409).send("This game already exists!");
        }

        const isValidCategory = await connection.query(`
            SELECT *
            FROM categories 
            WHERE id = ${categoryId};
        `);
        if (isValidCategory.rows.length === 0) {
            return res.status(400).send("This category id does not exist!");
        }

        await connection.query(`
            INSERT INTO games (
                name, 
                image, 
                "stockTotal", 
                "categoryId", 
                "pricePerDay"
            ) VALUES (
                '${name}',
                '${image}',
                ${stockTotal},
                ${categoryId},
                ${pricePerDay}
            );
        `);

        res.sendStatus(201);
    } catch (err) {
        res.sendStatus(500);
    }
});

//CUSTOMERS

app.get('/customers', async (req, res) => {

    try {
        const customers = await connection.query(`
            SELECT * FROM customers
            ${req.query.cpf ? 
                `WHERE customers.cpf LIKE '${req.query.cpf}%'` 
                : ""};
        `);
        if (customers.rows.length === 0) {
          return res.sendStatus(404);
        }

        customers.rows.forEach(customer =>
            customer.birthday = dayjs(customer.birthday).format('YYYY-MM-DD')
        )

        res.send(customers.rows);
    } catch (err) {
        res.sendStatus(500);
    }
});

app.get('/customers/:id', async (req, res) => {

    try {
        const customer = await connection.query(`
            SELECT * FROM customers
            WHERE id = '${req.params.id}';
        `);
        if (customer.rows.length === 0) {
          return res.status(404).send("This customer id does not exist!");
        }

        customer.rows[0].birthday = dayjs(customer.rows[0].birthday).format('YYYY-MM-DD');

        res.send(customer.rows);
    } catch (err) {
        res.sendStatus(500);
    }
});

app.post('/customers', async (req, res) => {

    try {
        const isCorrectBody = customerSchema.validate(req.body);
        if (isCorrectBody.error) {
            return res.status(400).send(`Bad Request: ${isCorrectBody.error.details[0].message}`);
        }

        const {
            name,
            phone,
            cpf,
            birthday
        } = req.body;

        const isNewCustomer = await connection.query(`
            SELECT cpf 
            FROM customers 
            WHERE cpf = '${cpf}';
        `);
        if (isNewCustomer.rows.length !== 0) {
            return res.status(409).send("This cpf is already registered!");
        }

        await connection.query(`
            INSERT INTO customers (
                name, 
                phone, 
                cpf, 
                birthday
            ) VALUES (
                '${name}',
                '${phone}',
                '${cpf}',
                '${birthday}'
            );
        `);

        res.sendStatus(201);
    } catch (err) {
        res.sendStatus(500);
    }
});

app.put('/customers/:id', async (req, res) => {

    try {
        const isCorrectBody = customerSchema.validate(req.body);
        if (isCorrectBody.error) {
            return res.status(400).send(`Bad Request: ${isCorrectBody.error.details[0].message}`);
        }

        const customer = await connection.query(`
            SELECT * FROM customers
            WHERE id = '${req.params.id}';
        `);
        if (customer.rows.length === 0) {
            return res.status(404).send("This customer id does not exist!");
        }

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
        res.sendStatus(500);
    }
});

//RENTALS

app.get('/rentals', async (req, res) => {

    try {
        const rentals = await connection.query(`
            SELECT rentals.*,
                customers.id AS "idCustomer",
                customers.name AS "customerName",
                games.id AS "idGame",
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

        const newRentals = rentals.rows.map(rental => {
            return {
                id: rental.id,
                customerId: rental.customerId,
                gameId: rental.gameId,
                rentDate: dayjs(rental.rentDate).format('YYYY/MM/DD').replace(/\//g,'-'),
                daysRented: rental. daysRented,
                returnDate: rental.returnDate,
                originalPrice: rental.originalPrice,
                delayFee: rental.delayFee,
                customer: {
                    id: rental.idCustomer,
                    name: rental.customerName
                },
                game: {
                    id: rental.idGame,
                    name: rental.gameName,
                    categoryId: rental.categoryId,
                    categoryName: rental.categoryName
                }
            }  
        });

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
                '${dayjs().format('YYYY/MM/DD').replace(/\//g,'-')}',
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

app.post('/rentals/:id/return', async (req, res) => {

    try {

        const rentalsObject = await connection.query(`
            SELECT rentals."gameId",
                rentals."rentDate"
            FROM rentals
            WHERE rentals.id = ${req.params.id}
        `)

        const gameId = rentalsObject.rows[0].gameId;
        const rentDate = dayjs(rentalsObject.rows[0].rentDate).format('YYYY/MM/DD').replace(/\//g,'-');

        const pricePerDay = await connection.query(`
            SELECT games."pricePerDay"
            FROM games
            WHERE games.id = ${gameId}
        `)

        const today = dayjs().format('YYYY/MM/DD').replace(/\//g,'-');

        const date1 = dayjs(rentDate);
        const date2 = dayjs(today);

        await connection.query(`
            UPDATE rentals 
            SET returnDate = '${today}', 
                delayFee = '${pricePerDay.rows[0].pricePerDay * (date2.diff(date1, 'day'))}', 
            WHERE id = ${req.params.id};
        `);

        res.sendStatus(200);
    } catch (err) {
        res.sendStatus(500);
    }
});

app.delete('/rentals/:id', async (req, res) => {

    try {
        await connection.query(`
            DELETE FROM rentals
            WHERE id = ${req.params.id};
        `);

        res.sendStatus(200);
    } catch (err) {
        res.sendStatus(500);
    }
});

app.listen(APP_PORT);