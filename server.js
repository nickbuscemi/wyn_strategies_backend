const express = require('express');
const bodyParser = require('body-parser');
const { check, validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const rateLimit = require('express-rate-limit');
const cors = require('cors');

const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 4000;

// Keep your existing variable name semantics
// (EMAIL_USER is now your verified "from" sender in Resend, not a Gmail login)
const gmail = process.env.EMAIL_USER;

// Where the team receives submissions (new env, replaces "to: gmail")
const teamInbox = process.env.TEAM_INBOX || gmail;

// Resend API key (no app passwords)
const resend = new Resend(process.env.RESEND_API_KEY);

const allowedOrigins = [
  'https://wynstrategies.com',
  'https://www.wynstrategies.com',
  'https://wyn-strategies.vercel.app',
  'http://localhost:3000',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.options('*', (req, res) => {
  // Keeping your existing preflight behavior
  res.setHeader('Access-Control-Allow-Origin', 'https://www.wynstrategies.com');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

// MIDDLEWARE
app.use(bodyParser.json());

// rate limiter for the contact form
const contactFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { msg: 'Too many requests from this IP, please try again later.' }
});

app.use('/api/contact', contactFormLimiter);

// Load the HTML template for confirmation email
const confirmationEmailHtml = fs.readFileSync(
  path.join(__dirname, 'emails', 'email2.html'),
  'utf8'
);

app.post(
  '/api/contact',
  [
    check('name').trim().escape().notEmpty().withMessage('Name is required.'),
    check('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
    check('phone').trim().escape().notEmpty().withMessage('Phone is required.'),
    check('subject').trim().escape().notEmpty().withMessage('Subject is required.'),
    check('message').trim().escape().notEmpty().withMessage('Message is required.')
  ],
  async (req, res) => {
    // 1. Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // 2. Destructure form inputs
    const { name, email, phone, subject, message } = req.body;

    // Extract the first name from the full name
    const firstName = name.split(' ')[0];

    try {
      // 5. Send an email to the team (contact form submission)
      // Keep same content as your nodemailer text block
      const teamText = `
Name: ${name}
Email: ${email}
Phone: ${phone}
Message: ${message}
      `.trim();

      await resend.emails.send({
        from: gmail, // must be a verified sender in Resend (e.g. "Wyn Strategies <contact@wynstrategies.com>")
        to: teamInbox, // where submissions should go
        subject: `New Contact Form Submission: ${subject}`,
        text: teamText,
        // This makes it easy for your team to hit "Reply" and respond to the user:
        replyTo: email,
      });

      // 6. Send a confirmation email to the user
      const personalizedHtml = confirmationEmailHtml.replace('{(name)}', firstName);

      await resend.emails.send({
        from: gmail,
        to: email,
        subject: `Thank you for reaching out to Wyn Strategies.`,
        html: personalizedHtml,
      });

      // 7. Respond to the client
      return res.status(200).json({ msg: 'Form submitted successfully!' });
    } catch (error) {
      console.error('Error sending email:', error);
      return res.status(500).json({ msg: 'Internal server error' });
    }
  }
);

// Start the server (only for local development)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

// Export for Vercel serverless
module.exports = app;


/*const express = require('express');
const bodyParser = require('body-parser');
const { check, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // if you want to use environment variables from a .env file

const app = express();
const PORT = process.env.PORT || 4000;

const gmail = process.env.EMAIL_USER;
const appPassword = process.env.EMAIL_PASS;

const rateLimit = require('express-rate-limit');
const cors = require('cors');

const allowedOrigins = [
  'https://wynstrategies.com',
  'https://www.wynstrategies.com',
  'https://wyn-strategies.vercel.app',
  'http://localhost:3000',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));


app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.wynstrategies.com');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200); // 🔥 Ensure HTTP 200 response for preflight
});





// MIDDLEWARE
app.use(bodyParser.json());  // parse JSON request bodies
//app.use(cors()); // enable CORS

// rate linmiter for the contact form
const contactFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: { msg: 'Too many requests from this IP, please try again later.' }
});

app.use('/api/contact', contactFormLimiter);

// Load the HTML template for confirmation email
const confirmationEmailHtml = fs.readFileSync(path.join(__dirname, 'emails', 'email2.html'), 'utf8');

// Example route for contact form
app.post(
  '/api/contact',
  [
    check('name').trim().escape().notEmpty().withMessage('Name is required.'),
    check('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
    check('phone').trim().escape().notEmpty().withMessage('Phone is required.'),
    check('subject').trim().escape().notEmpty().withMessage('Subject is required.'),
    check('message').trim().escape().notEmpty().withMessage('Message is required.')
  ],
  async (req, res) => {
    // 1. Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // If validation fails, return 400 with the error messages
      return res.status(400).json({ errors: errors.array() });
    }

    // 2. Destructure form inputs
    const { name, email, phone, subject, message } = req.body;

    // Extract the first name from the full name (split by space)
    const firstName = name.split(' ')[0]; // This will get the first word of the name


    try {
      // 3. (Optional) Save the data to a DB or do other processing
      // e.g., MySQL, MongoDB, etc. (not shown here)

      // 4. Configure Nodemailer (Gmail example)
      const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
          user: gmail, // e.g., your Gmail address
          pass: appPassword, // your Gmail password or app password
        },
      });

      // 5. Send an email to the team (contact form submission)
      const teamMailOptions = {
        from: email, // or a "noreply@yourdomain.com"
        to: gmail, // where the form submissions should go
        subject: `New Contact Form Submission: ${subject}`,
        text: `
          Name: ${name}
          Email: ${email}
          Phone: ${phone}
          Message: ${message}
        `,
      };

      await transporter.sendMail(teamMailOptions);

      // 6. Send a confirmation email to the user
      const userMailOptions = {
        from: gmail, // "noreply" address for your domain
        to: email, // The user's email
        subject: `Thank you for reaching out to Wyn Strategies.`,
        html: confirmationEmailHtml.replace('{(name)}', firstName), // Use HTML and replace the placeholder
      };

      await transporter.sendMail(userMailOptions);

      // 7. Respond to the client
      return res.status(200).json({ msg: 'Form submitted successfully!' });
    } catch (error) {
      console.error('Error sending email:', error);
      return res.status(500).json({ msg: 'Internal server error' });
    }
  }
);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});*/


