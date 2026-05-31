const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('./models/User');
const Account = require('./models/Account');
const Transaction = require('./models/Transaction');
const Notification = require('./models/Notification');
const WithdrawalRequest = require('./models/WithdrawalRequest');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await User.deleteMany({});
  await Account.deleteMany({});
  await Transaction.deleteMany({});
  await Notification.deleteMany({});
  await WithdrawalRequest.deleteMany({});
  console.log('Cleared data.');

  const admin = await User.create({ firstName: 'Admin', lastName: 'User', email: 'admin@nexusbank.com', password: 'admin123', role: 'admin' });

  const users = await User.create([
    { firstName: 'Alice', lastName: 'Johnson', email: 'alice@example.com', password: 'password123' },
    { firstName: 'Bob',   lastName: 'Smith',   email: 'bob@example.com',   password: 'password123' },
    { firstName: 'Carol', lastName: 'Davis',   email: 'carol@example.com', password: 'password123' },
  ]);

  for (const u of users) {
    await Account.create([
      { user: u._id, accountType: 'checking', balance: 5000,  currency: 'USD' },
      { user: u._id, accountType: 'savings',  balance: 20000, currency: 'USD' },
    ]);
  }

  // Sample transactions
  const allAccounts = await Account.find({ user: { $in: users.map(u => u._id) } });
  const txs = [];
  const cats = ['Groceries', 'Entertainment', 'Transport', 'Shopping', 'Housing', 'Income', 'Transfer'];
  const descs = { Groceries: 'Supermarket', Entertainment: 'Streaming Service', Transport: 'Gas Station', Shopping: 'Online Shopping', Housing: 'Monthly Rent', Income: 'Payroll Deposit', Transfer: 'Account Transfer' };
  for (let i = 0; i < 30; i++) {
    const cat = cats[i % cats.length];
    const userIdx = i % users.length;
    const acc = allAccounts.find(a => a.user.toString() === users[userIdx]._id.toString());
    const d = new Date(); d.setDate(d.getDate() - i);
    txs.push({ user: users[userIdx]._id, fromAccount: acc._id, type: cat === 'Income' ? 'deposit' : 'transfer', amount: parseFloat((50 + Math.random() * 500).toFixed(2)), currency: 'USD', description: descs[cat], category: cat, status: 'completed', createdAt: d });
  }
  await Transaction.insertMany(txs);

  // Welcome notifications
  for (const u of users) {
    await Notification.create({ user: u._id, title: ' Welcome to Nexus Bank!', message: 'Your account has been created. Explore your dashboard.', type: 'success' });
  }

  console.log('Admin: admin@nexusbank.com / admin123');
  console.log(' Users: alice@example.com, bob@example.com, carol@example.com / password123');
  process.exit(0);
};

seed().catch(e => { console.error(e); process.exit(1); });
