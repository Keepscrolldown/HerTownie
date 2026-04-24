const API_URL = window.location.origin;

async function loadTrendingProducts() {
    const grid = document.getElementById('products-grid');
    const loader = document.getElementById('products-loading');

    try {
        const response = await fetch(`${API_URL}/api/products`);
        const products = await response.json();

        loader.style.display = 'none';

        if (products.length === 0) {
            document.getElementById('no-products').style.display = 'block';
            return;
        }

        // Displaying only the first 4 for the "Trending" look
        grid.innerHTML = products.slice(0, 4).map(product => `
            <div class="product-card" onclick="window.open('product-details.html?id=${product.id}', '_blank')">
                <div class="product-image">
                    <img src="${product.image}" alt="${product.name}">
                    ${product.stock < 5 ? '<span class="tag">Low Stock</span>' : ''}
                </div>
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <p class="product-price">₹${product.price.toLocaleString('en-IN')}</p>
                </div>
            </div>
        `).join('');
    } catch (error) {
        loader.textContent = "Failed to load collection.";
    }
}

document.addEventListener('DOMContentLoaded', loadTrendingProducts);