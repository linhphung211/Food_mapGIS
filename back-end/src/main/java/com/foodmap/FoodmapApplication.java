package com.foodmap;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class FoodmapApplication {
    public static void main(String[] args) {
        SpringApplication.run(FoodmapApplication.class, args);
    }
}
