const requireAdmin = require('./requireAdmin');

function requireSuperAdmin(req, res, next) {
  return requireAdmin(req, res, (error) => {
    if (error) return next(error);
    if (req.adminUser?.role !== 'superadmin') {
      return res.status(403).json({ message: 'Super Admin access is required' });
    }
    return next();
  });
}

module.exports = requireSuperAdmin;
