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
 * pay money from client to contractor
 */
app.post('/jobs/:job_id/pay', async (req, res) => {
  try {
    await sequelize.transaction(async (t) => {
      const profileId = req.get('profile_id');
      const profile = await Profile.findOne(
        { where: { id: profileId } },
        { transaction: t }
      );
      const { amount } = req.body;
      const balance = profile.balance;
      if (balance < amount) {
        throw new Error('user have no money for this payment');
      }
      if (profile.dataValues.type !== 'client') {
        throw new Error('only client can pay to the contractor');
      }
      const clientProfileUpdated = await Profile.decrement(
        {
          balance: amount,
        },
        {
          where: { id: profile.dataValues.id },
        },
        { transaction: t }
      );
      const job = await Job.findOne(
        {
          where: { id: req.params.job_id },
          include: { model: Contract, where: { status: 'in_progress' } },
        },
        { transaction: t }
      );

      const contractorId = job.dataValues.Contract.dataValues.ContractorId;
      const cotractorProfileUpdated = await Profile.increment(
        {
          balance: amount,
        },
        {
          where: { id: contractorId },
        },
        { transaction: t }
      );
      res.json({ success: true });
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});
/**
 * Deposits money into the the the balance of a client,
 * a client can't deposit more than 25% his total of jobs to pay
 */
app.post('/balances/deposit/:userId', async (req, res) => {
  try {
    await sequelize.transaction(async (t) => {
      const profileId = req.get('profile_id');
      const { deposit } = req.body;
      const profile = await Profile.findOne(
        {
          where: { id: profileId },
          include: [
            {
              model: Contract,
              as: 'Client',
              where: { status: 'in_progress' },
              include: { model: Job },
            },
          ],
        },
        { transaction: t }
      );
      console.log({
        profile: profile.dataValues.Client[0].dataValues.Jobs[0].dataValues,
      });
      let jobsToPaySumm = 0;
      const jobSumm = profile.dataValues.Client.forEach((client) => {
        client.dataValues.Jobs.forEach((job) => {
          console.log({ job: job.dataValues.price });
          jobsToPaySumm = jobsToPaySumm + job.dataValues.price;
        });
      });
      const maxSummClientCanPay = jobsToPaySumm * 0.25;
      if (deposit > maxSummClientCanPay) {
        throw new Error(
          `a client can not deposit more than ${maxSummClientCanPay} (25% his total of jobs to pay)`
        );
      }
      const profileUpdated = await Profile.update(
        { balance: profile.balance + deposit },
        { where: { id: profile.id } },
        { transaction: t }
      );
    });
    res.send({ success: true });
  } catch (error) {
    res.send({ error: error.message });
  }
});

module.exports = app;
