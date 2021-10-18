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

const rentalSchema = Joi.object().length(3).keys({
    customerId: Joi.number().integer().positive().required(),
    gameId: Joi.number().integer().positive().required(),
    daysRented: Joi.number().integer().greater(0).required(),
});

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

app.get('/games', async (req, res) => {

    try {
        const games = await connection.query(`
            SELECT games.*, 
                categories.name AS "categoryName"
            FROM games 
            JOIN categories 
                ON games."categoryId" = categories.id
            WHERE games.name iLIKE $1;
        `, [req.query.name ? `${req.query.name}%` : '%'])

        if (games.rows.length === 0) {
          return res.sendStatus(404);
        }

        const rentalsCount = await connection.query(`
            SELECT "gameId",
                COUNT(*) AS "rentalsCount" 
            FROM rentals 
            GROUP BY "gameId";
        `)

        games.rows.forEach(game => {
            game.rentalsCount = rentalsCount.rows.find(elem => elem.gameId === game.id).rentalsCount
        })

        res.send(games.rows);
    } catch (err) {
        console.log(err)
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

app.get('/customers', async (req, res) => {

    try {
        const customers = await connection.query(`
            SELECT * FROM customers
            WHERE customers.cpf LIKE $1;
        `, [req.query.cpf ? `${req.query.cpf}%` : '%']);

        if (customers.rows.length === 0) {
          return res.sendStatus(404);
        }

        const rentalsCount = await connection.query(`
            SELECT "customerId",
                COUNT(*) AS "rentalsCount" 
            FROM rentals 
            GROUP BY "customerId";
        `)

        customers.rows.forEach(customer => {
            customer.rentalsCount = rentalsCount.rows.find(elem => elem.customerId === customer.id).rentalsCount
        })

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

app.get('/rentals', async (req, res) => {

    try {
        const rentals = await connection.query(`
            SELECT rentals.*,
                customers.name AS "customerName",
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
            WHERE CAST(rentals."customerId" AS varchar) LIKE $1
                AND CAST(rentals."gameId" AS varchar) LIKE $2
        `, [
            req.query.customerId ? `${req.query.customerId}` : '%',
            req.query.gameId ? `${req.query.gameId}` : '%'
        ]);

        rentals.rows.forEach(rental => {
            rental.rentDate = dayjs(rental.rentDate).format('YYYY-MM-DD');
            rental.returnDate = (rental.returnDate ? (dayjs(rental.returnDate).format('YYYY-MM-DD')) : (null));
            rental.customer = {
                id: rental.customerId,
                name: rental.customerName
            };
            rental.game = {
                id: rental.gameId,
                name: rental.gameName,
                categoryId: rental.categoryId,
                categoryName: rental.categoryName
            };
            delete rental.customerName, 
            delete rental.gameName, 
            delete rental.categoryId, 
            delete rental.categoryName
        });

        if (rentals.rows.length === 0) {
          return res.sendStatus(404);
        }

        res.send(rentals.rows);
    } catch (err) {
        res.sendStatus(500);
    }
});

app.post('/rentals', async (req, res) => {

    try {
        const isCorrectBody = rentalSchema.validate(req.body);
        if (isCorrectBody.error) {
            return res.status(400).send(`Bad Request: ${isCorrectBody.error.details[0].message}`);
        }

        const {
            customerId,
            gameId,
            daysRented
        } = req.body;

        const isValidCustomerId = await connection.query(`
            SELECT id
            FROM customers
            WHERE customers.id = '${customerId}';
        `)
        if (isValidCustomerId.rows.length === 0) {
            return res.status(400).send("Invalid customer id");
        }

        const isValidGameId = await connection.query(`
            SELECT id
            FROM games
            WHERE games.id = '${gameId}';
        `)
        if (isValidGameId.rows.length === 0) {
            return res.status(400).send("Invalid game id");
        }

        const chosenGame = await connection.query(`
            SELECT games."stockTotal",
                games."pricePerDay"
            FROM games
            WHERE games.id = ${gameId};
        `)

        const pricePerDay = chosenGame.rows[0].pricePerDay;
        const numberOfGames = chosenGame.rows[0].stockTotal;

        const listOfRentals = await connection.query(`
            SELECT id
            FROM rentals
            WHERE rentals."gameId" = '${gameId}';
        `)

        const numberOfRentals = listOfRentals.rows.length;

        if (numberOfRentals > numberOfGames) {
            return res.status(400).send("This game is out of stock at the moment");
        }

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
                '${dayjs().format('YYYY-MM-DD')}',
                ${daysRented},
                ${null},
                ${daysRented * pricePerDay},
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
        const isValidRentalId = await connection.query(`
            SELECT id
            FROM rentals
            WHERE rentals.id = '${req.params.id}';
        `)
        if (isValidRentalId.rows.length === 0) {
            return res.status(404).send("Invalid rental id");
        }

        const isRentalAlreadyFinished = await connection.query(`
            SELECT "returnDate"
            FROM rentals
            WHERE rentals.id = '${req.params.id}';
        `)
        if (isRentalAlreadyFinished.rows[0].returnDate) {
            return res.status(400).send("This rental has already been finished");
        }

        const rentalsList = await connection.query(`
            SELECT "gameId",
                "rentDate",
                "daysRented"
            FROM rentals
            WHERE rentals.id = ${req.params.id};
        `)

        const gameId = rentalsList.rows[0].gameId;
        const rentDate = dayjs(rentalsList.rows[0].rentDate).format('YYYY-MM-DD');
        const daysRented = rentalsList.rows[0].daysRented;
        const maxDateToReturn = dayjs(rentDate).add(daysRented, 'day').format('YYYY-MM-DD');
        const today = dayjs().format('YYYY-MM-DD');
        const datesDifference = dayjs(today).diff(dayjs(maxDateToReturn), 'day');
        let daysOfDelay = 0;

        if (datesDifference > 0) {
            daysOfDelay = datesDifference;
        }

        const gameList = await connection.query(`
            SELECT "pricePerDay"
            FROM games
            WHERE games.id = ${gameId};
        `)
        const pricePerDay = gameList.rows[0].pricePerDay;

        await connection.query(`
            UPDATE rentals
            SET "returnDate" = '${today}', 
                "delayFee" = '${pricePerDay * daysOfDelay}'
            WHERE id = ${req.params.id};
        `);

        res.sendStatus(200);
    } catch (err) {
        res.sendStatus(500);
    }
});

app.delete('/rentals/:id', async (req, res) => {

    try {
        const isValidRentalId = await connection.query(`
            SELECT id
            FROM rentals
            WHERE rentals.id = '${req.params.id}';
        `)
        if (isValidRentalId.rows.length === 0) {
            return res.status(404).send("Invalid rental id");
        }

        const isRentalAlreadyFinished = await connection.query(`
            SELECT "returnDate"
            FROM rentals
            WHERE rentals.id = '${req.params.id}';
        `)
        if (isRentalAlreadyFinished.rows[0].returnDate) {
            return res.status(400).send("This rental has already been finished");
        }

        await connection.query(`
            DELETE FROM rentals
            WHERE id = ${req.params.id};
        `);

        res.sendStatus(200);
    } catch (err) {
        res.sendStatus(500);
    }
});

app.get('/rentals/metrics', async (req, res) => {

    try {
        const getMetrics = `
            SELECT SUM("originalPrice") + SUM("delayFee") AS revenue,
                COUNT(*) AS rentals,
                (SUM("originalPrice") + SUM("delayFee"))/COUNT(*) AS average
            FROM rentals 
            WHERE CAST(rentals."returnDate" AS varchar) <> ''
        `
        let finishedRentals;

        if (req.query.startDate && req.query.endDate) {
            finishedRentals = await connection.query(
                getMetrics + `
                AND rentals."rentDate" >= CAST('$1' AS Date)
                AND rentals."returnDate" <= CAST('$2' AS Date);
                `, [req.query.startDate, req.query.endDate]      
            )
        } else if (req.query.startDate) {
            finishedRentals = await connection.query(
                getMetrics + `
                AND rentals."rentDate" >= CAST($1 AS Date);
                `, [req.query.startDate]      
            )
        } else if (req.query.endDate) {
            finishedRentals = await connection.query(
                getMetrics + `
                AND rentals."returnDate" <= CAST($1 AS Date);
                `, [req.query.endDate]
            )
        }
        
        res.status(200).send(finishedRentals.rows[0]);
    } catch (err) {
        res.sendStatus(500);
    }
})

app.listen(APP_PORT);