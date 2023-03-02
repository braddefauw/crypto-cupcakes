require('dotenv').config('.env');
const cors = require('cors');
const express = require('express');
const app = express();
const morgan = require('morgan');
const { PORT = 4000 } = process.env;
// TODO - require express-openid-connect and destructure auth from it
const { auth } = require('express-openid-connect');
const jwt = require('jsonwebtoken');
const { User, Cupcake } = require('./db');

// middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({extended:true}));

/* *********** YOUR CODE HERE *********** */
// follow the module instructions: destructure config environment variables from process.env
// follow the docs:
// define the config object
// attach Auth0 OIDC auth router
// create a GET / route handler that sends back Logged in or Logged out

const {
  JWT_SECRET = 'neverTell',
  AUTH0_SECRET,
  AUTH0_AUDIENCE,
  AUTH0_CLIENT_ID,
  AUTH0_BASE_URL,
} = process.env;

const config = {
  authRequired: false,
  auth0Logout: true,
  secret: AUTH0_SECRET,
  baseURL: AUTH0_AUDIENCE,
  clientID: AUTH0_CLIENT_ID,
  issuerBaseURL: AUTH0_BASE_URL
};

// auth router attaches /login, /logout, and /callback routes to the baseURL
app.use(auth(config));

// createUser router
app.use(async (req, res, next) => {
  if (req.oidc.user) {
    const [user] = await User.findOrCreate({
      where: {
        username: req.oidc.user.nickname,
        name: req.oidc.user.name,
        email: req.oidc.user.email,
      }
    });
  }
  next();
});

app.use(async (req, res, next) => {
  try {
    const auth = req.header('Authorization');
    if (auth) {
      const token = auth.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findByPk(decoded.id);
      req.user = user;
    }
    next();
  } catch (error) {
    next(error);    
  }
});

app.post('/cupcakes', async (req, res, next) => {
  const { title, flavor, stars } = req.body;
  if(req.user) {
    const cupcake = await Cupcake.create({
      title,
      flavor,
      stars,
      userId: req.user.id,
    });
    res.json(cupcake);
  } else {
    res.status(401).send('You must be logged in to create a cupcake');
  }
});

app.get('/me', async (req, res, next) => {
  if(req.oidc.user) {
    const user = await User.findOne({
      where: {
        username: req.oidc.user.nickname
      },
      raw: true
    });
    delete user.password;
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '1w' });
    res.json({user, token});
  } else {
    res.json({user: null, token: null});
  }
})

app.get('/', (req, res) => {
  console.log(req.oidc.user);
  res.send(req.oidc.isAuthenticated() ? `
      <h2 style="text-align: center;">My Web App, Inc.</h2>
      <h2>Welcome, ${req.oidc.user.name}</h2>
      <p><b>Username: ${req.oidc.user.email}</b></p>
      <p>${req.oidc.user.email}</p>
      <img src="${req.oidc.user.picture}" alt="${req.oidc.user.name}">
    ` : 'Logged out');
});

app.get('/cupcakes', async (req, res, next) => {
  try {
    const cupcakes = await Cupcake.findAll();
    res.send(cupcakes);
  } catch (error) {
    console.error(error);
    next(error);
  }
});

// error handling middleware
app.use((error, req, res, next) => {
  console.error('SERVER ERROR: ', error);
  if(res.statusCode < 400) res.status(500);
  res.send({error: error.message, name: error.name, message: error.message});
});

app.listen(PORT, () => {
  console.log(`Cupcakes are ready at http://localhost:${PORT}`);
});

