const API_URL = window.location.origin;
let products = [];
let cart = JSON.parse(localStorage.getItem('clothify_cart')) || [];

/* ================= INIT ================= */

document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
    startCarousel();
    updateAuthUI();
    updateCartUI();
});

/* ================= FETCH PRODUCTS ================= */

async function fetchProducts() {
    const loadingEl = document.getElementById('products-loading');
    const gridEl = document.getElementById('products-grid');
    const noProductsEl = document.getElementById('no-products');

    try {
        const response = await fetch(`${API_URL}/api/products`);
        products = await response.json();

        if (loadingEl) loadingEl.style.display = 'none';

        if (products.length > 0) {
            renderProducts();
        } else if (noProductsEl) {
            noProductsEl.style.display = 'block';
        }

    } catch (error) {
        console.error('Error fetching products:', error);
        if (loadingEl) loadingEl.textContent = 'Failed to load products';
    }
}

/* ================= RENDER PRODUCTS ================= */

function renderProducts() {
    const gridEl = document.getElementById('products-grid');
    if (!gridEl) return;

    gridEl.innerHTML = '';

    const displayItems = products.slice(-4).reverse();

    displayItems.forEach((product, index) => {

        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.style.opacity = "0";
        productCard.style.transform = "translateY(30px)";
        productCard.style.transition = `all 0.6s ease ${index * 0.1}s`;

        productCard.innerHTML = `
            <div class="product-image-container">
                <img src="${product.image}" 
                     alt="${product.name}" 
                     class="product-image cursor-pointer"
                     onclick="window.location.href='product-details.html?id=${product.id}'">
                
                <button onclick="event.stopPropagation(); addToCart('${product.id}')"
                    class="add-to-cart-button">
                    Quick Add +
                </button>
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-price">
                    ₹${Number(product.price).toLocaleString('en-IN')}
                </p>
            </div>
        `;

        gridEl.appendChild(productCard);
        observer.observe(productCard);
    });
}

/* ================= CART FUNCTIONS ================= */

function addToCart(productId) {
    const product = products.find(p => p.id == productId);
    if (!product) return;

    const existingItem = cart.find(item => item.id == productId);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            ...product,
            quantity: 1
        });
    }

    localStorage.setItem('clothify_cart', JSON.stringify(cart));

    updateCartUI();
    toggleCart();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    localStorage.setItem('clothify_cart', JSON.stringify(cart));
    updateCartUI();
}

function updateCartUI() {
    const cartList = document.getElementById('cart-items-list');
    const subtotalEl = document.getElementById('cart-subtotal');
    const cartCount = document.getElementById('cart-count');

    if (!cartList || !subtotalEl || !cartCount) return;

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;

    if (cart.length === 0) {
        cartList.innerHTML = `
            <div class="text-center py-20 text-gray-400 italic">
                Your bag is empty
            </div>
        `;
        subtotalEl.textContent = `₹0`;
        return;
    }

    let total = 0;

    cartList.innerHTML = cart.map((item, index) => {

        total += Number(item.price) * item.quantity;

        return `
        <div class="flex gap-4 border-b pb-4">
            <div class="w-20 h-28 overflow-hidden bg-gray-100">
                <img src="${item.image}" 
                     class="w-full h-full object-cover">
            </div>
            <div class="flex-1 flex flex-col justify-between">
                <div>
                    <h3 class="text-xs font-bold uppercase">
                        ${item.name}
                    </h3>
                    <p class="text-sm font-bold mt-1">
                        ₹${Number(item.price).toLocaleString('en-IN')}
                    </p>
                    <p class="text-xs text-gray-500 mt-1">
                        Qty: ${item.quantity}
                    </p>
                </div>
                <button onclick="removeFromCart(${index})"
                    class="text-[10px] uppercase font-bold text-red-500 hover:underline">
                    Remove
                </button>
            </div>
        </div>
        `;
    }).join('');

    subtotalEl.textContent = `₹${total.toLocaleString('en-IN')}`;
}

/* ================= CHECKOUT ================= */

function handleCheckoutRedirect() {
    const token = localStorage.getItem('userToken');

    if (!token) {
        localStorage.setItem('redirectAfterLogin', 'checkout.html');
        alert("Please login to proceed with your order.");
        window.location.href = 'login.html';
    } else {
        window.location.href = 'checkout.html';
    }
}

/* ================= AUTH UI ================= */

function updateAuthUI() {
    const userName = localStorage.getItem('userName');
    const authSection = document.getElementById('auth-section');

    if (!authSection) return;

    if (userName) {
        authSection.innerHTML = `
            <div class="flex items-center gap-4">
                <span class="text-[10px] font-bold uppercase tracking-widest">
                    Hi, ${userName}
                </span>
                <button onclick="logout()"
                    class="text-[10px] font-bold uppercase text-red-500 hover:underline">
                    Logout
                </button>
            </div>
        `;
    } else {
        authSection.innerHTML = `
            <a href="login.html"
               class="text-[10px] font-bold uppercase tracking-widest">
                Login / Signup
            </a>
        `;
    }
}

function logout() {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userName');
    window.location.reload();
}

/* ================= CART TOGGLE ================= */

function toggleCart() {
    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('cart-overlay');

    if (!sidebar || !overlay) return;

    sidebar.classList.toggle('translate-x-full');
    overlay.classList.toggle('hidden');
}

/* ================= CAROUSEL ================= */

function startCarousel() {
    const carousel = document.getElementById('carousel-container');
    if (!carousel) return;

    let scrollAmount = 0;

    setInterval(() => {
        const slideWidth = carousel.clientWidth;

        if (scrollAmount >= (carousel.children.length - 1) * slideWidth) {
            scrollAmount = 0;
        } else {
            scrollAmount += slideWidth;
        }

        carousel.scrollTo({
            left: scrollAmount,
            behavior: 'smooth'
        });

    }, 5000);
}

/* ================= SCROLL ANIMATION ================= */

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = "1";
            entry.target.style.transform = "translateY(0)";
        }
    });
}, { threshold: 0.1 });
