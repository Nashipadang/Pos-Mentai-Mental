package main

import (
	"fmt"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	hash := "$2a$10$w6D.P448r1NUpfP301lU0.w6s6Wsh734a74.1JmH9hC/vF/2F8mye"
	password := "password123"
	
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	if err != nil {
		fmt.Printf("FAIL: hash does NOT match 'password123': %v\n", err)
		
		// Let's generate a correct one!
		newHash, _ := bcrypt.GenerateFromPassword([]byte("password123"), 10)
		fmt.Printf("Correct hash for 'password123': %s\n", string(newHash))
	} else {
		fmt.Println("SUCCESS: hash matches 'password123'!")
	}
}
