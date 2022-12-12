const getProfile = async (req, res, next) => {
  const { Profile } = require('../model');
  const profileId = req.get('profile_id');
  if (!profileId) {
    res.json({ error: 'no profile_id in request' });
  }
  const profile = await Profile.findOne({
    where: { id: profileId },
  });
  if (!profile) return res.status(401).end();
  req.profile = profile;
  next();
};
module.exports = { getProfile };
