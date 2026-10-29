class ProductDetail {
    buttonAddToCart = 'Add to cart';
    notificationAddCart = 'window:alert';

    addToCart() {
        cy.contains(this.buttonAddToCart).click();
    }
    
    verifyNotification(expectedText) {
        cy.on(this.notificationAddCart, (alertText) => {
            expect(alertText).to.include(expectedText);
            return true;
        });
    }
}

export default ProductDetail;