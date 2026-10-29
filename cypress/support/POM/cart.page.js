class CartPage {
  dataTable = '.success';
  buttonDelete = 'Delete';
  buttonPlaceOrder = 'Place Order';
  // modal order
  modalOrder = '.modal-content';
  inputName = '#name';
  inputCountry = '#country';
  inputCity = '#city';
  inputCard = '#card';
  inputMonth = '#month';
  inputYear = '#year';
  buttonPurchase = 'Purchase';
  buttonClose = 'Close';
  // succes alert
  successAlert = '.sweet-alert';
  textSuccess = 'Thank you for your purchase!';
  textName = 'Name';
  textCard = 'Card Number';
  // window alert
  alert = 'window:alert';

  verifyDataTable() {
    cy.get(this.dataTable).should('have.length.at.least', 1).and('be.visible');
  }
  
  verifyEmptyCart() {
    cy.get(this.dataTable).should('not.exist');
  }

  verifyDeleteProduct() {
    cy.get(this.dataTable).its('length').then((initialLength) => {
      cy.contains(this.buttonDelete).first().click();
      cy.get(this.dataTable).should('have.length', initialLength - 1);
    });
  }

  clickPlaceOrder() {
    cy.contains(this.buttonPlaceOrder).click();
  }

  fillOrderForm(name, country, city, card, month, year) {
    cy.get(this.inputName).type(name);
    cy.get(this.inputCountry).type(country);
    cy.get(this.inputCity).type(city);
    cy.get(this.inputCard).type(card);
    cy.get(this.inputMonth).type(month);
    cy.get(this.inputYear).type(year);
  }

  clickPurchase() {
    cy.contains(this.buttonPurchase).click();
  }

  clickClose() {
    cy.contains(this.buttonClose).click();
  }

  verifySuccessAlert() {
    cy.get(this.successAlert).should('be.visible');
    cy.get(this.successAlert).should('contain', this.textSuccess);
    cy.get(this.successAlert).should('contain', this.textName);
    cy.get(this.successAlert).should('contain', this.textCard);
  }

  verifyAlertMessage(expectedMessage) {
    cy.on(this.alert, (message) => {
      expect(message).to.include(expectedMessage);
      return true;
    });
  }
}

export default CartPage;