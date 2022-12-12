const express = require('express');
const bodyParser = require('body-parser');
const { Op } = require('sequelize');
const { sequelize, Contract, Job } = require('./model');
const { getProfile } = require('./middleware/getProfile');

const app = express();
app.use(bodyParser.json());

/**
 * FIX ME!
 * @returns contract by id
 */
app.get('/contracts/:id', getProfile, async (req, res) => {
  const { id } = req.params;
  const contract = await Contract.findOne({
    where: { id, ClientId: req.profile.dataValues.id },
  });
  if (!contract) return res.status(404).end();
  res.json(contract);
});
app.get('/contracts', getProfile, async (req, res) => {
  const allUserContracts = await Contract.findAll({
    where: {
      status: { [Op.ne]: 'terminated' },
      [Op.or]: [
        { ClientId: req.profile.dataValues.id },
        { ContractorId: req.profile.dataValues.id },
      ],
    },
  });
  res.json(allUserContracts);
});
// TODO add transaction
app.get('/jobs/unpaid', getProfile, async (req, res) => {
  const unpaidUserJobs = await Job.findAll({
    where: {
      paid: null,
    },
    include: {
      model: Contract,
      where: {
        status: 'in_progress',
        [Op.or]: [
          { ClientId: req.profile.dataValues.id },
          { ContractorId: req.profile.dataValues.id },
        ],
      },
    },
  });
  res.json(unpaidUserJobs);
});
// TODO add transaction
app.post('/jobs/:job_id/pay', async (req, res) => {
  const profileId = req.get('profile_id');

  const { amount } = req.body;
  console.log({ amount });
  const job_id = req.params.job_id;
  console.log('job_id', req.params.job_id);
  const balance = req.profile.dataValues.balance;
  console.log({ balance });
  if (balance < amount) {
    return res.json({ error: 'user have no money for this payment' });
  }
  if (req.profile.dataValues.type !== 'client') {
    P;
    return res.json({ error: 'only client can pay to the contractor' });
  }
  const { Job } = req.app.get('models');
  const { Contract } = req.app.get('models');
  const { Profile } = req.app.get('models');
  const clientProfileUpdated = await Profile.update({
    where: { id: req.profile.dataValues.id },
    balance: req.profile.dataValues.balance - amount,
  });
  // get balance of contractor
  const cotractorProfileUpdated = await Profile.update({
    balance: req.profile.dataValues.balance + amount,
    include: {
      model: Job,
      wher: {
        id: req.params.job_id,
      },
    },
  });
  res.json({ success: true });
});
module.exports = app;
