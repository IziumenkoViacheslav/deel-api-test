const express = require('express');
const bodyParser = require('body-parser');
const { Op } = require('sequelize');
const { sequelize } = require('./model');
const { getProfile } = require('./middleware/getProfile');

const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize);
app.set('models', sequelize.models);

/**
 * FIX ME!
 * @returns contract by id
 */
app.get('/contracts/:id', getProfile, async (req, res) => {
  const { Contract } = req.app.get('models');
  const { id } = req.params;
  const contract = await Contract.findOne({
    where: { id, ClientId: req.profile.dataValues.id },
  });
  if (!contract) return res.status(404).end();
  res.json(contract);
});
app.get('/contracts', getProfile, async (req, res) => {
  const { Contract } = req.app.get('models');
  const contracts = await Contract.findAll({
    where: {
      status: { [Op.ne]: 'terminated' },
      [Op.or]: [
        { ClientId: req.profile.dataValues.id },
        { ContractorId: req.profile.dataValues.id },
      ],
    },
  });
  if (contracts.lenght) return res.status(404).end();
  res.json(contracts);
});
module.exports = app;
