**Example Scenario for Refined Grouping Strategy:**

Imagine we have the following transactions in a specific category (e.g., "Courses"):

- **T1:** Label: "Carrefour courses", Amount: -50, Date: 2024-01-10
- **T2:** Label: "Carrefour Market", Amount: -48, Date: 2024-02-15
- **T3:** Label: "Courses Leclerc", Amount: -52, Date: 2024-03-20
- **T4:** Label: "Carrefour Express", Amount: -51, Date: 2024-04-25
- **T5:** Label: "Boulangerie", Amount: -10, Date: 2024-05-01
- **T6:** Label: "Courses U Express", Amount: -55, Date: 2024-05-10
- **T7:** Label: "Carrefour Courses", Amount: -49, Date: 2024-06-12

Assume `computeLabelSimilarity("Carrefour courses", "Carrefour Market")` is 0.8, `computeLabelSimilarity("Carrefour courses", "Courses Leclerc")` is 0.3, and `computeLabelSimilarity("Carrefour courses", "Carrefour Express")` is 0.9.
Also assume `computeLabelSimilarity("Courses Leclerc", "Courses U Express")` is 0.75.

**Grouping Process:**

1.  **Initial: `categoryGroups` is empty.**

2.  **Process T1:**
    - No existing groups.
    - Create `Group A = [T1]` (Label: "Carrefour courses", Amount: -50)
    - `categoryGroups = [Group A]`

3.  **Process T2:**
    - Try to add T2 (Label: "Carrefour Market", Amount: -48) to `Group A`.
    - **Label Similarity Check:**
      - Compare T2 to T1: `computeLabelSimilarity("Carrefour Market", "Carrefour courses")` = 0.8.
      - Average similarity for Group A (only T1 currently): 0.8 / 1 = 0.8. (which is >= 0.7)
    - **Amount Variance Check:**
      - Group A Avg Amount: 50.
      - T2 Amount: 48.
      - Lower bound: 50 _ 0.8 = 40. Upper bound: 50 _ 1.2 = 60.
      - 48 is between 40 and 60. (Passed)
    - Add T2 to `Group A`. `Group A = [T1, T2]` (Avg Amount: 49)
    - `categoryGroups = [Group A]`

4.  **Process T3:**
    - Try to add T3 (Label: "Courses Leclerc", Amount: -52) to `Group A`.
    - **Label Similarity Check:**
      - Compare T3 to T1: `computeLabelSimilarity("Courses Leclerc", "Carrefour courses")` = 0.3.
      - Compare T3 to T2: `computeLabelSimilarity("Courses Leclerc", "Carrefour Market")` = 0.35 (hypothetical).
      - Average similarity for Group A: (0.3 + 0.35) / 2 = 0.325. (which is < 0.7)
    - T3 does not fit in `Group A`.
    - Create `Group B = [T3]` (Label: "Courses Leclerc", Amount: -52)
    - `categoryGroups = [Group A, Group B]`

5.  **Process T4:**
    - Try to add T4 (Label: "Carrefour Express", Amount: -51) to `Group A`.
    - **Label Similarity Check:**
      - Compare T4 to T1: `computeLabelSimilarity("Carrefour Express", "Carrefour courses")` = 0.9.
      - Compare T4 to T2: `computeLabelSimilarity("Carrefour Express", "Carrefour Market")` = 0.85 (hypothetical).
      - Average similarity for Group A: (0.9 + 0.85) / 2 = 0.875. (which is >= 0.7)
    - **Amount Variance Check:**
      - Group A Avg Amount: 49.
      - T4 Amount: 51.
      - Lower bound: 49 _ 0.8 = 39.2. Upper bound: 49 _ 1.2 = 58.8.
      - 51 is between 39.2 and 58.8. (Passed)
    - Add T4 to `Group A`. `Group A = [T1, T2, T4]` (Avg Amount: 49.67)
    - `categoryGroups = [Group A, Group B]`

6.  **Process T5:**
    - Try to add T5 (Label: "Boulangerie", Amount: -10) to `Group A`.
      - Similarity will likely be low. (Fail)
    - Try to add T5 to `Group B`.
      - Similarity will likely be low. (Fail)
    - Create `Group C = [T5]` (Label: "Boulangerie", Amount: -10)
    - `categoryGroups = [Group A, Group B, Group C]`

7.  **Process T6:**
    - Try to add T6 (Label: "Courses U Express", Amount: -55) to `Group A`. (Fail similarity)
    - Try to add T6 to `Group B`.
      - **Label Similarity Check:**
        - Compare T6 to T3: `computeLabelSimilarity("Courses U Express", "Courses Leclerc")` = 0.75.
        - Average similarity for Group B (only T3 currently): 0.75 / 1 = 0.75. (which is >= 0.7)
      - **Amount Variance Check:**
        - Group B Avg Amount: 52.
        - T6 Amount: 55.
        - Lower bound: 52 _ 0.8 = 41.6. Upper bound: 52 _ 1.2 = 62.4.
        - 55 is between 41.6 and 62.4. (Passed)
      - Add T6 to `Group B`. `Group B = [T3, T6]` (Avg Amount: 53.5)
    - `categoryGroups = [Group A, Group B, Group C]`

8.  **Process T7:**
    - Try to add T7 (Label: "Carrefour Courses", Amount: -49) to `Group A`.
    - **Label Similarity Check:**
      - Compare T7 to T1: `computeLabelSimilarity("Carrefour Courses", "Carrefour courses")` = 1.0.
      - Compare T7 to T2: `computeLabelSimilarity("Carrefour Courses", "Carrefour Market")` = 0.8 (hypothetical).
      - Compare T7 to T4: `computeLabelSimilarity("Carrefour Courses", "Carrefour Express")` = 0.9 (hypothetical).
      - Average similarity for Group A: (1.0 + 0.8 + 0.9) / 3 = 0.9. (which is >= 0.7)
    - **Amount Variance Check:**
      - Group A Avg Amount: 49.67.
      - T7 Amount: 49.
      - Lower bound: 49.67 _ 0.8 = 39.736. Upper bound: 49.67 _ 1.2 = 59.604.
      - 49 is between 39.736 and 59.604. (Passed)
    - Add T7 to `Group A`. `Group A = [T1, T2, T4, T7]` (Avg Amount: 49.5)
    - `categoryGroups = [Group A, Group B, Group C]`

**Final Grouped Transactions (before temporal filter):**

- **Group A:** [T1, T2, T4, T7] (all "Carrefour" related, avg ~€49.5)
- **Group B:** [T3, T6] (all "Courses U/Leclerc" related, avg ~€53.5)
- **Group C:** [T5] (Boulangerie, avg ~€10)
