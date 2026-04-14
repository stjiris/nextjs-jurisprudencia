import GenericPage from "@/components/main_pages/genericPageStructure";
import { LoggerServerSideProps } from "@/core/logger-api";
import { withRole } from "@/core/user/authenticate";
import { ROLES, Role } from "@/core/user/roles";
import { listUsers, User } from "@/core/user/usercrud";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useState } from "react";

interface UsersPageProps {
    users: (User & { id: string })[]
}

export const getServerSideProps: GetServerSideProps<UsersPageProps> = LoggerServerSideProps(withRole('manageUsers', async (ctx) => {
    let r = await listUsers();
    return { props: { users: r.hits.hits.map(({ _id, _source: u }) => ({ id: _id || "", username: u?.username || "", salt: u?.salt || "", hash: u?.hash || "", role: u?.role ?? 'admin' })) } }
}))

export default function UsersPage({ users: initialUsers }: UsersPageProps) {
    const router = useRouter();
    const [users, setUsers] = useState(initialUsers);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<Role>('editor');
    const [error, setError] = useState('');

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        try {
            const res = await fetch(`${router.basePath}/api/admin/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role })
            });
            const data = await res.json();
            if (!data.ok) { setError(data.message); return; }
            setUsers(u => [...u, { id: '', username, salt: '', hash: '', role }]);
            setUsername(''); setPassword('');
        } catch (err: any) {
            setError(err?.message || 'Erro desconhecido');
        }
    }

    async function handleDelete(u: string) {
        if (!confirm(`Apagar utilizador "${u}"?`)) return;
        try {
            const res = await fetch(`${router.basePath}/api/admin/users`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: u })
            });
            const data = await res.json();
            if (!data.ok) { alert(data.message); return; }
            setUsers(us => us.filter(x => x.username !== u));
        } catch (err: any) {
            alert(err?.message || 'Erro desconhecido');
        }
    }

    return <GenericPage title="Jurisprudência STJ - Utilizadores">
        <div className="row justify-content-sm-center">
            <div className="col-sm-12 col-md-8 col-xl-6">

                <div className="card shadow mb-3">
                    <div className="card-body">
                        <h5 className="card-title">Criar utilizador</h5>
                        <form onSubmit={handleCreate}>
                            <div className="mb-2">
                                <input className="form-control" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
                            </div>
                            <div className="mb-2">
                                <input className="form-control" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
                            </div>
                            <div className="mb-2">
                                <select className="form-select" value={role} onChange={e => setRole(e.target.value as Role)}>
                                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            {error && <div className="text-danger mb-2">{error}</div>}
                            <button className="btn btn-primary" type="submit">Criar</button>
                        </form>
                    </div>
                </div>

                <div className="card shadow">
                    <div className="card-body">
                        <h5 className="card-title">Utilizadores</h5>
                        <table className="table table-sm">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Role</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u, i) => (
                                    <tr key={i}>
                                        <td>{u.username}</td>
                                        <td><span className="badge bg-secondary">{u.role}</span></td>
                                        <td>
                                            {u.username !== 'admin' && (
                                                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(u.username)}>
                                                    Apagar
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    </GenericPage>
}
