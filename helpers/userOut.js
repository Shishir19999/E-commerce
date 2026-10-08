// Shape of a user returned by the API (never includes the password hash or token version)
export const userOut = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  address: u.address,
  role: u.role,
  storeName: u.storeName || "",
  sellerRequest: !!u.sellerRequest,
});
