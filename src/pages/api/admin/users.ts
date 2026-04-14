import LoggerApi from "@/core/logger-api";
import { authenticatedHandlerWithRole } from "@/core/user/authenticate";
import { ROLES, Role } from "@/core/user/roles";
import { createUser, deleteUser, listUsers } from "@/core/user/usercrud";
import { NextApiRequest, NextApiResponse } from "next";

export default LoggerApi(async function adminUsersHandler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (!(await authenticatedHandlerWithRole(req, 'manageUsers'))) {
        return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    if (req.method === 'POST') {
        const { username, password, role } = req.body;
        if (!username || !password) return res.status(400).json({ ok: false, message: 'username and password required' });
        if (!role || !(ROLES as readonly string[]).includes(role)) return res.status(400).json({ ok: false, message: `role must be one of: ${ROLES.join(', ')}` });
        const created = await createUser(username, password, role as Role);
        if (!created) return res.status(409).json({ ok: false, message: 'User already exists' });
        return res.json({ ok: true });
    }

    if (req.method === 'DELETE') {
        const { username } = req.body;
        if (!username) return res.status(400).json({ ok: false, message: 'username required' });
        if (username === 'admin') return res.status(400).json({ ok: false, message: 'Cannot delete admin' });
        await deleteUser(username);
        return res.json({ ok: true });
    }

    return res.status(405).json({ ok: false });
});
