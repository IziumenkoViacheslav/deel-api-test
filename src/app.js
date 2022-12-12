const express = require('express');
const bodyParser = require('body-parser');
const { Op } = require('sequelize');
const { sequelize, Contract, Job, Profile } = require('./model');
const { getProfile } = require('./middleware/getProfile');

const app = express();
app.use(bodyParser.json());

/**
 * @returns contract by id
 */
app.get('/contracts/:id', async (req, res) => {
  const profileId = req.get('profile_id');
  const { id } = req.params;
  const contract = await Contract.findOne({
    where: {
      id,
      [Op.or]: [{ ClientId: profileId }, { ContractorId: profileId }],
    },
  });
  if (!contract) return res.status(404).end();
  res.json(contract);
});
/**
 * @returns all contracts for user
 */
app.get('/contracts', async (req, res) => {
  const profileId = req.get('profile_id');

  const allUserContracts = await Contract.findAll({
    where: {
      status: { [Op.ne]: 'terminated' },
      [Op.or]: [{ ClientId: profileId }, { ContractorId: profileId }],
    },
  });
  res.json(allUserContracts);
});
/**
 * @returns unpaid jobs for user
 */
app.get('/jobs/unpaid', async (req, res) => {
  const profileId = req.get('profile_id');
  const unpaidUserJobs = await Job.findAll({
    where: {
      paid: null,
    },
    include: {
      model: Contract,
      where: {
        status: 'in_progress',
        [Op.or]: [{ ClientId: profileId }, { ContractorId: profileId }],
      },
    },
  });
  res.json(unpaidUserJobs);
});
/**
 * move money from client to contractor
 */
app.post('/jobs/:job_id/pay', async (req, res) => {
  try {
    const profileId = req.get('profile_id');
    const profile = await Profile.findOne({ where: { id: profileId } });

    const { amount } = req.body;
    console.log({ amount });
    const job_id = req.params.job_id;
    console.log('job_id', req.params.job_id);
    const balance = profile.balance;
    console.log({ balance });
    if (balance < amount) {
      return res.json({ error: 'user have no money for this payment' });
    }
    if (profile.dataValues.type !== 'client') {
      return res.json({ error: 'only client can pay to the contractor' });
    }
    console.log({ profile: profile.dataValues.id });
    console.log(
      'profile.dataValues.balance - amount',
      profile.dataValues.balance - amount
    );
    const clientProfileUpdated = await Profile.update(
      {
        balance: profile.dataValues.balance - amount,
      },
      {
        where: { id: profile.dataValues.id },
      }
    );
    const job = await Job.findOne({
      where: { id: req.params.job_id },
      include: { model: Contract },
    });
    const contractorId = job.dataValues.Contract.dataValues.ContractorId;
    console.log({ contractorId });
    const cotractorProfileUpdated = await Profile.update(
      {
        balance: profile.dataValues.balance + amount,
      },
      {
        where: { id: contractorId },
      }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(404).end();
  }
});
module.exports = app;
