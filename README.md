To Do:

address css mobile: move the submit order card to buttom 

Manage admin page to controll customer pages 
= Can customize header on each pages
= connect to any category
= 

Admin order pages:
= view orders filters
= confirm order (choose what item is unavailable or need price update)
= refund order
= manage order status
= delivery estimation
= add message to reply to order via telegram and gmail
= 

User page:
= view order
= filter order by status
= awaiting payment
= awaiting review
= request refund on unsuccessful order

= setting:
= view ID
= username
= phone number/telegram
= gmail

integrate bot:
https://share.google/aimode/rxWpCyxlrNJ3ENX3D
= recieve orders
= recieve payment alert (want this to connect with OrderID)

aba payway integration:
https://developer.payway.com.kh/

redesign database in canva for better understanding

Add select product in admin page

update login and signup pages ui

front end varaint logic: for product with charcater name just let them note in order

admin cant remove product from inventory, should set status to out of stock and pre order after remove from inventory

change customer option name to varaint because we dropped product option and replaced with variant instead

⚠️ You'll need to check this too: your frontend's saveProduct() posts to /admin/products, not /products — that controller isn't one of the files you've shown me. If it also calls Product.setOptions(...), it'll throw once the model method is gone. Worth a quick search for setOptions or an options field in that file.
⚠️ Also worth checking: if your customer-facing storefront (not shown to me) renders product.options on the product detail page to let shoppers pick a variant before adding to cart, that needs to switch to reading product.variants (variant_name) instead, since findById no longer returns options.