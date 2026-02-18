// Temporary login simulation

const users = [
  {
    email: "student@campus.com",
    password: "1234",
    role: "student"
  },
  {
    email: "admin@campus.com",
    password: "1234",
    role: "admin"
  }
];

export function login(email, password) {

  const user = users.find(
    (u) => u.email === email && u.password === password
  );

  if (user) {
    localStorage.setItem("userRole", user.role);
    return user.role;
  }

  return null;
}

export function getRole() {
  return localStorage.getItem("userRole");
}

export function logout() {
  localStorage.removeItem("userRole");
}
