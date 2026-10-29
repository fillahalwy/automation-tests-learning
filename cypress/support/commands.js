Cypress.Commands.add('clearTempData', () => {
  cy.clearCookies();
  cy.clearLocalStorage();
});

Cypress.Commands.add('seedCart', (productIds = [1]) => {
  // Session ID 
  const sessionId = `guid-${Math.random().toString(36).substring(2, 10)}`;
  cy.setCookie('user', sessionId);

  // Tambah produk via API
  productIds.forEach((prodId) => {
    cy.request({
      method: 'POST',
      url: 'https://api.demoblaze.com/addtocart',
      body: {
        id: sessionId,
        cookie: `user=${sessionId}`,
        prod_id: prodId,
        flag: false
      }
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
  });

  cy.visit('/cart.html');
});
