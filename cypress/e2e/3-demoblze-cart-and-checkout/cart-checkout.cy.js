describe('Demoblaze - Cart & Checkout Automation', () => {

  // PRECONDITION - Berada dihalaman beranda
  context('Berada diluar halaman Cart', () => {
beforeEach(() => {
      cy.clearLocalStorage();
      cy.clearCookies();
      cy.visit('https://demoblaze.com/prod.html?idp_=1#');
    });

    // TC003
    it('Harus bisa menyimpan produk ke keranjang', () => {
      cy.contains('a', 'Add to cart').should('be.visible');
      
      cy.on('window:alert', (alertText) => {
        expect(alertText).to.eq('Product added'); 
        return true;
      });
      
      cy.contains('a', 'Add to cart').click();
    });

    // TC004 dan TC005
    it('Harus bisa menyimpan produk yang sama ke keranjang', () => {
      cy.contains('a', 'Add to cart').should('be.visible');
      
      cy.on('window:alert', (alertText) => {
        expect(alertText).to.include('Product added');
        return true;
      });
      
      cy.contains('a', 'Add to cart').click();
    });
  });

  // PRECONDITION - KERANJANG KOSONG
  context('Keranjang Berisi 0 Produk', () => {
    beforeEach(() => {
      cy.clearLocalStorage();
      cy.clearCookies();
      cy.visit('https://demoblaze.com/cart.html');
    });

    // TC002
    it('Harus menampilkan data Cart kosong', () => {
      cy.get('.success').should('not.exist');
    });
  });

  // PRECONDITION - KERANJANG TERISI MIN. 1 PRODUK
  context('Keranjang Berisi Min. 1 Produk', () => {
    beforeEach(() => {
      cy.clearLocalStorage();
      cy.clearCookies();
      
      cy.seedCart(); 
      cy.visit('https://demoblaze.com/cart.html');
    });

    // TC001
    it('Harus menampilkan daftar produk yang telah disimpan', () => {
      cy.get('.success').should('have.length.at.least', 1).and('be.visible');
    });

    // TC006
    it('Harus bisa menghapus produk dari keranjang', () => {
      cy.intercept('POST', '**/deleteitem').as('deleteItem');
      
      cy.get('.success').its('length').then((initialCount) => {
        cy.contains('Delete').click();
        cy.wait('@deleteItem');

        cy.get('.success').should('have.length', initialCount - 1);
      });
    });

    it('Checkout gagal karena data wajib (Name/Credit card) kosong', () => {
      cy.contains('button', 'Place Order').click();
      cy.get('#orderModal').should('be.visible');

      cy.get('#country').type('Indonesia');
      cy.get('#city').type('Jakarta');

      cy.on('window:alert', (alertText) => {
        expect(alertText).to.contains('Please fill out Name and Creditcard.');
      });

      cy.contains('button', 'Purchase').click();
    });

    it('Checkout berhasil dengan semua data valid', () => {
      cy.contains('button', 'Place Order').click();
      cy.get('#orderModal').should('be.visible');

      cy.get('#name').type('Jhon Doe'); 
      cy.get('#country').type('India'); 
      cy.get('#city').type('Mumbay');
      cy.get('#card').type('12345');
      cy.get('#month').type('10');
      cy.get('#year').type('2026');

      cy.intercept('POST', '**/deletecart').as('processCheckout');
      cy.contains('button', 'Purchase').click();
      cy.wait('@processCheckout');

      cy.get('.sweet-alert').should('be.visible');
      cy.contains('h2', 'Thank you for your purchase!').should('be.visible');
      
      cy.get('.lead.text-muted')
        .should('contain', 'Name: Jhon Doe')
        .and('contain', 'Card Number: 12345');
    });
  });
});