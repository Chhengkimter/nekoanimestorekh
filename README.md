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

~ = setting:
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

update login and signup pages ui

front end varaint logic: for product with charcater name just let them note in order

~ change customer option name to varaint because we dropped product option and replaced with variant instead

~ if order has not been confirmed by admin yet, admin can modify the order and customer will see it is marked as modified by admin and they need to confirm the modified then the order would be move to confirmed by dafault seen the admin already look at it and modify it. Also since my store policy is that customer can pick between full payment (include shipping) or they can pay 50% first for pre order item then pay the rest when its arrived. Plus, cash on delivery is available for the last 50% and product that are instock but only if location in pp would cash on delivery be possible. for province always full payment before shipping so here is the flow.
 1. customer order pre order product: pay 50% -> order sent -> awaiting confirmation => confirmed -> shipped -> deliveried
 2. customer order instock product (inventory is not 0): fill address, make a feild where we make a check box asking if location is in phnom penh => if phnom penh ask if they want cash on delivery or full paymnet on website -> order sent -> awaiting confirmation -> confirmed -> shipped -> deliveried
 3. customer order both pre order and instock product: same logic as pre order product
As for admin flow in case we need to modify order  (modify only available if order is not confirmed) it will show to customer that their order has a modified status and they will received a notification (implementing later) -> customer confirm the modified -> admin see it is confirmed

~ add wishlist to userpage 

~ clicking on product in cart will take customer to that product page

~ get cart-badge working on every pages and mobile.

i notice if a product is pre order it show in the product page but instock doesnt have instock label, i want each all to have its own label so customer will know.

~ clicking on order from the order history will show full detail of order and what has been modified by admin check show rather customer confirm/reject/contact store (if the order was modify by admin before or after confirming it has to be in the customer awaiting action status, this status is waiting for customer to answer to the modified and also use when awaiting the other half payment sent by admin by making the order status "awaiting final payment" and show pay final bill button to them) 

mobile ui move submit order button to the button instead of the top

~ clicking update address/phone and the motify button should not open the order detial (currently it opened both) i think whatever click on thebig card will always open the detail page.

~ allowing to change order status from the main order page instead of having to click it (keep the original just add more on the main page so i can easily click it) if i set the status to shipped it will pop up a fill in page for me. in that page i have the option for 3 delivered company on top for me to click which one i used 
1. J&T express
2. VET express
3. Jalat express
next is fill in the tracking number and auto fill in the date to the current date for me. setting a picture submitting will be optional.
from the customer page they will get all this info too. oh make sure there is a paste button to paste the tracking number in admin page. and copy button to copy the tracking number in customer page.

~ once product is noted as shipped the buttons should show from the main page not just the detailed page (customer user page).

~ in admin panel, the order detail, i want it to be larger to fill the entire screen (on phone not sure how the current is but on laptop the current layout is too small). make the product clickable and also provide productID , the detail of the order should be enchanced instead of being small but don't make it out of place too much. also both of the notes to customer and admin are all not working properly. 

~ in the admin product page i want the status to be pre order instead of out of stock for pre order product, however if the product is mark as instock product and we ran out of inventory it suppose to still show out of stock. (pre order does not mean out of stock). for the top 4 display i want to add another card counting pre order product, instock product instead of only having total product. 

~ small bug when admin manually add order. add product button has a little glitch where it opens another add order voerlay and i have to close it to see the add product pop up, check it. 

~ Both of the note in admin modify order is not working, after filling it and unclick on it it will clear back to blank.

~ in admin order page, the status box of the order is not styled. give it some css. also i want to make each order a bit larger currently i find it too small. maybe 1.5 times bigger.

~ Admin new page: quests and coupons area. define discount rate, min spent, max of dollar. expiration date. how many coupon can be used in a time. also how many times a user can claim a single coupon. see which user has claimed which coupon, used what. each coupon used will also be shown on record like how much was the order, how much saved. also for the coupon we can set on which categories of products the coupon can and can not used on. 

~ for customer side of coupon. add a new page in userpage maybe below wishlist. the quest and coupon area. customer can see the coupons details and new quest waiting for completion. 

~ review section of a product. each review will undergo admin approval to make sure the review is appropriate and belong to that product. admin can also link the same review to multiple products. if approved it will be shown on the product page, if rejected it will be hidden. admin will also have the right to delete a review. since some quest is linked to completing a review, only approved review will count of completion of the quest. 

create a system where when a user creates an account, an email will be sent to their email address to verify their account.  this can later be used for account password reset or if user forgot their password. 

~ admine new page: Finance. this page should have a calender for the admin to view revenue in a range of date and a bar chart showing total revenue. each order will now have a profit column where admin can manually enter how much they have earn from that single order. show profit and make a section to record spending such as ads and content ceator.
make sure each have a filter for weekly, monthly and yearly. its like a finance corner of the store you know.

In the cart view give the customer option to add that product into wishlist.
In order history detial give customer the ability to click on the product to go to the product page.

~ currently i see only the coupon function. i want another quest function (can be in the same page but quest is sth user must complete and also check fro condition).
the quest creation in admin can check based on review counts, purchase counts, wishlist counts, items in an order counts(ex: buy more than 3 products in a single order will get discount...)

~ is it possible to track items per click? 

Bot function
- Buy products that are not on website.
- Combine order request (save on shipping for small order)

~ Add submission of the review to include picture (optional) and then customer can edit the review before admin approve it (choose to add picture after submission but not yet approved by admin is allowed it).

~ add css to componnent with no css such as the group by drop down and the action button in expense table. 

~ 1. failed to load review
~ 2. review ui in product page is horrible because it open up on top for no reason as img i provided
~ 3. profit fit in is empty after successfully saved, i want it to display the profit afteer filling it and also give it a css. 
~ 4. finance page adding expense save button does not show anything even after succeed, i want it to display message and close the fill in foam then reload the expense into the table right away.

~ give css to the review in product page, maybe the whole review is deign placed in a single card and then other review follow by in another different card, give css to the write review button. make sure it matches the product page design. 

~ admin review page: add a "All" button for showing all the reviews

~ work on product page because review section ui is bad.

fully work on coupon and quest logic. connect between customer and admin side. make sure all condition is correct and carry the discount values throught the entire order process and status and history and record. everything should be smooth and clean.

pending order deduce the stock until it is refund, canceled or modifying it later on calculate the stock accordingly. refund and cancel will add back the stock. make modify deduct accordingly.

~ cart variant stock is not counting correctly.