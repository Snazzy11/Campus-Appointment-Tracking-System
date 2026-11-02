
import {ScrollView, StyleSheet, Pressable} from 'react-native';

import {ThemedText} from '@/shared/components/ThemedText';
import {ThemedView} from '@/shared/components/ThemedView';

import {Spacing} from '@/shared/constants/theme';



export function HomeScreen() {
  return (

    <ScrollView>
      
      <ThemedView style = {styles.container}>
        <ThemedText>
          Welcome to CATS
          </ThemedText> 
   

      <ThemedText themeColor="textSecondary">
       Your campus appointment dashboard
      </ThemedText>

      <ThemedView
      type="backgroundElement"
      style={styles.card} >

        <ThemedText type ="smallBold">
          Upcoming Appointments
        </ThemedText>

        <ThemedText>
          No upcoming appointments
        </ThemedText>

        <Pressable
        style={styles.button}

        onPress={() => console.log('Book appoitmnent')} >

          <ThemedText style={styles.buttonText}>
            Book an Appoitment
          
          </ThemedText>
        </Pressable>
    
    </ThemedView>
      </ThemedView>
    </ScrollView>
    
  );
}

const styles = StyleSheet.create({

  container: {

    flexGrow: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },

  card: {
    padding: Spacing.four,
    borderRadius: 12,
    gap: Spacing.two,
    marginTop: Spacing.four,
  },

  button: {
    backgroundColor: '#2563EB',
    padding: Spacing.three,
    borderRadius: 12,
    alignItems: 'center',
  },

  buttonText: {
    color: 'FFFFFF',
    fontWeight: 'bold',
  }
});
