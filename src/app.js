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
    const balance = profile.balance;
    if (balance < amount) {
      throw new Error('user have no money for this payment');
    }
    if (profile.dataValues.type !== 'client') {
      throw new Error('only client can pay to the contractor');
    }
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
      include: { model: Contract, where: { status: 'in_progress' } },
    });

    const contractorId = job.dataValues.Contract.dataValues.ContractorId;
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
    res.json({ error: error.message });
  }
});
module.exports = app;
