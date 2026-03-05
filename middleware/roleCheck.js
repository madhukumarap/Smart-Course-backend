const Role = require('../models/Role');

// Check if user has super admin role
exports.superAdmin = async (req, res, next) => {
    try {
        const role = await Role.findById(req.user.roleId);
        
        if (!role || role.slug !== 'super_admin') {
            return res.status(403).json({ 
                message: 'Access denied. Super admin privileges required.' 
            });
        }
        
        next();
    } catch (error) {
        console.error('Error checking super admin:', error);
        res.status(500).json({ message: 'Error checking permissions' });
    }
};

// Check if user has admin role (including super admin)
exports.admin = async (req, res, next) => {
    try {
        const role = await Role.findById(req.user.roleId);
        
        if (!role || !['super_admin', 'admin'].includes(role.slug)) {
            return res.status(403).json({ 
                message: 'Access denied. Admin privileges required.' 
            });
        }
        
        next();
    } catch (error) {
        console.error('Error checking admin:', error);
        res.status(500).json({ message: 'Error checking permissions' });
    }
};

// Check if user has specific permission
exports.hasPermission = (permissionSlug) => {
    return async (req, res, next) => {
        try {
            const role = await Role.findById(req.user.roleId);
            
            if (!role || !role.permissions.includes(permissionSlug)) {
                return res.status(403).json({ 
                    message: `Access denied. Required permission: ${permissionSlug}` 
                });
            }
            
            next();
        } catch (error) {
            console.error('Error checking permission:', error);
            res.status(500).json({ message: 'Error checking permissions' });
        }
    };
};

// Check if user has any of the specified permissions
exports.hasAnyPermission = (permissionSlugs) => {
    return async (req, res, next) => {
        try {
            const role = await Role.findById(req.user.roleId);
            
            if (!role || !permissionSlugs.some(p => role.permissions.includes(p))) {
                return res.status(403).json({ 
                    message: 'Access denied. Required permissions not found.' 
                });
            }
            
            next();
        } catch (error) {
            console.error('Error checking permissions:', error);
            res.status(500).json({ message: 'Error checking permissions' });
        }
    };
};