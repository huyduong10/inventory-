export const filterProductsAfterDelete = (products, productId, deletedSuccessfully) => {
  if (!deletedSuccessfully) {
    return products;
  }

  return products.filter((product) => product._id !== productId);
};
