import ProductDetail from "../../support/POM/product-detail.page";
import CartPage from "../../support/POM/cart.page";

const productDetail = new ProductDetail();
const cartPage = new CartPage();

const { validPlaceOrder, invalidPlaceOrder, emptyPlaceOrder } = require('../../fixtures/placeOrder.json');

describe('Demoblaze - Cart & Checkout Automation', () => {

  // PRECONDITION - Berada dihalaman beranda
  context('Berada di halaman Product Detail', () => {
    beforeEach(() => {
      cy.clearTempData();
      cy.visit('/prod.html?idp_=1#');
    });

    // TC003
    it('Harus bisa menyimpan produk ke keranjang', () => {
      productDetail.addToCart();
      productDetail.verifyNotification('Product added');
    });

    // TC004 dan TC005
    it('Harus bisa menyimpan produk yang sama ke keranjang', () => {
      for (let i = 0; i < 2; i++) {
        productDetail.addToCart();
        productDetail.verifyNotification('Product added');
      }
    });
  });

  // PRECONDITION - KERANJANG KOSONG
  context('Keranjang Berisi 0 Produk', () => {
    beforeEach(() => {
      cy.clearTempData();
      cy.visit('/cart.html');
    });

    // TC002
    it('Harus menampilkan data Cart kosong', () => {
      cartPage.verifyEmptyCart();
    });
  });

  // PRECONDITION - KERANJANG TERISI MIN. 1 PRODUK
  context('Keranjang Berisi Min. 1 Produk', () => {
    beforeEach(() => {
      cy.clearTempData();
      cy.seedCart();
    });

    // TC001
    it('Harus menampilkan daftar produk yang telah disimpan', () => {
      cartPage.verifyDataTable();
    });

    // TC006
    it('Harus bisa menghapus produk dari keranjang', () => {
      cartPage.verifyDeleteProduct();
    });

    // TC010
    it('Checkout gagal karena data wajib (Name/Credit card) tidak valid', () => {
      cartPage.clickPlaceOrder();
      cartPage.fillOrderForm(
        invalidPlaceOrder.name,
        invalidPlaceOrder.country,
        invalidPlaceOrder.city,
        invalidPlaceOrder.card,
        invalidPlaceOrder.month,
        invalidPlaceOrder.year);
      cartPage.clickPurchase();
      cartPage.verifyAlertMessage('Please fill out Name and Creditcard.');
    });

    // Data kosong
    it('Checkout gagal karena data wajib (Name/Credit card) kosong', () => {
      cartPage.clickPlaceOrder();
      cartPage.fillOrderForm(
        validPlaceOrder.name,
        emptyPlaceOrder.country,
        emptyPlaceOrder.city,
        validPlaceOrder.card,
        emptyPlaceOrder.month,
        emptyPlaceOrder.year);
      cartPage.clickPurchase();
      cartPage.verifyAlertMessage('Please fill out Name and Creditcard.');
    });

    // TC011
    it('Checkout berhasil dengan semua data valid', () => {
      cartPage.clickPlaceOrder();
      cartPage.fillOrderForm(
        validPlaceOrder.name,
        validPlaceOrder.country,
        validPlaceOrder.city,
        validPlaceOrder.card,
        validPlaceOrder.month,
        validPlaceOrder.year
      );
      cartPage.clickPurchase();
      cartPage.verifySuccessAlert();
    });
  });
});