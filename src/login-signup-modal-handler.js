//login and signup
const modal = document.getElementById("loginModal");
const loginSignupLink = document.getElementById("login");
const closeModal = document.getElementById("closeModal");

//open modal when button is clicked
loginSignupLink.addEventListener('click', () => {
  modal.style.display="block";
})

//close modal when x is clicked
closeModal.addEventListener('click', () => {
  modal.style.display="none";
})

//close modal when user clicks outside modal
window.addEventListener('click', (event) => {
  if(event.target == modal){
    modal.style.display="none";
  }
})

//open login/signup form
function openTab(evt, formName){
  const tabContents = document.getElementsByClassName("tabcontent");
  for(let i=0; i<tabContents.length; i++){
    tabContents[i].style.display = "none";
  }
  const tabLinks = document.getElementsByClassName("tablinks");
  for(let i=0; i<tabLinks.length; i++){
    tabLinks[i].classList.remove("active");
  }
  document.getElementById(formName).style.display = "block";
  evt.currentTarget.classList.add("active");
}

//set default tab to "Login"
document.getElementById("defaultOpen").click();